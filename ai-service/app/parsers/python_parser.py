import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser

from app.parsers.base import BaseParser, ParsedFile, ParsedImport, ParsedSymbol, SymbolKind

PYTHON_LANGUAGE = Language(tspython.language())


def _text(node: Node, source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _decorators(decorated_node: Node, source: bytes) -> list[str]:
    return [_text(child, source) for child in decorated_node.children if child.type == "decorator"]


def _docstring(block_node: Node | None, source: bytes) -> str | None:
    if block_node is None or not block_node.children:
        return None

    first = block_node.children[0]
    if first.type != "expression_statement" or not first.children:
        return None

    string_node = first.children[0]
    if string_node.type != "string":
        return None

    content_parts = [
        _text(child, source) for child in string_node.children if child.type == "string_content"
    ]
    return "".join(content_parts).strip() or None


def _signature(def_node: Node, body_node: Node | None, source: bytes) -> str:
    end_byte = body_node.start_byte if body_node else def_node.end_byte
    return source[def_node.start_byte : end_byte].decode("utf-8", errors="replace").rstrip(": \n\t")


def _extract_function(func_node: Node, source: bytes, kind: SymbolKind, decorators: list[str]) -> ParsedSymbol:
    name_node = func_node.child_by_field_name("name")
    body_node = func_node.child_by_field_name("body")

    return ParsedSymbol(
        kind=kind,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=func_node.start_point[0] + 1,
        end_line=func_node.end_point[0] + 1,
        signature=_signature(func_node, body_node, source),
        doc_comment=_docstring(body_node, source),
        metadata={"decorators": decorators} if decorators else {},
    )


def _extract_class(class_node: Node, source: bytes, decorators: list[str]) -> ParsedSymbol:
    name_node = class_node.child_by_field_name("name")
    body_node = class_node.child_by_field_name("body")
    superclasses_node = class_node.child_by_field_name("superclasses")

    methods: list[ParsedSymbol] = []
    if body_node is not None:
        for child in body_node.children:
            method_node = child
            method_decorators: list[str] = []

            if child.type == "decorated_definition":
                method_decorators = _decorators(child, source)
                method_node = child.child_by_field_name("definition")

            if method_node is not None and method_node.type == "function_definition":
                methods.append(_extract_function(method_node, source, SymbolKind.METHOD, method_decorators))

    metadata: dict = {"decorators": decorators} if decorators else {}
    if superclasses_node is not None:
        metadata["superclasses"] = _text(superclasses_node, source).strip("()").strip()

    return ParsedSymbol(
        kind=SymbolKind.CLASS,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=class_node.start_point[0] + 1,
        end_line=class_node.end_point[0] + 1,
        signature=_signature(class_node, body_node, source),
        doc_comment=_docstring(body_node, source),
        metadata=metadata,
        children=methods,
    )


def _extract_imports(node: Node, source: bytes) -> list[ParsedImport]:
    if node.type == "import_statement":
        modules = [_text(c, source) for c in node.children if c.type == "dotted_name"]
        return [ParsedImport(module=module) for module in modules]

    if node.type == "import_from_statement":
        # Relative imports (`from .b import x`) parse as a `relative_import` node,
        # not `dotted_name` - the previous version here only looked for
        # `dotted_name` and silently mistook the first imported name for the module.
        module_node = next((c for c in node.children if c.type in ("relative_import", "dotted_name")), None)
        if module_node is None:
            return []
        module = _text(module_node, source)

        imported_names: list[str] = []
        for child in node.children:
            if child is module_node:
                continue
            if child.type == "dotted_name":
                imported_names.append(_text(child, source))
            elif child.type == "aliased_import":
                imported_names.append(_text(child, source))
            elif child.type == "wildcard_import":
                imported_names.append("*")

        return [ParsedImport(module=module, imported_names=imported_names)]

    return []


class PythonParser(BaseParser):
    language = "python"
    file_extensions = (".py",)

    def __init__(self) -> None:
        self._parser = Parser(PYTHON_LANGUAGE)

    def parse(self, file_path: str, source_code: bytes) -> ParsedFile:
        tree = self._parser.parse(source_code)
        root = tree.root_node

        imports: list[ParsedImport] = []
        symbols: list[ParsedSymbol] = []

        for child in root.children:
            imports.extend(_extract_imports(child, source_code))

            node = child
            decorators: list[str] = []
            if child.type == "decorated_definition":
                decorators = _decorators(child, source_code)
                node = child.child_by_field_name("definition")

            if node is None:
                continue

            if node.type == "function_definition":
                symbols.append(_extract_function(node, source_code, SymbolKind.FUNCTION, decorators))
            elif node.type == "class_definition":
                symbols.append(_extract_class(node, source_code, decorators))

        return ParsedFile(
            path=file_path,
            language=self.language,
            lines_of_code=len(source_code.splitlines()),
            imports=imports,
            symbols=symbols,
            module_doc_comment=_docstring(root, source_code),
        )
