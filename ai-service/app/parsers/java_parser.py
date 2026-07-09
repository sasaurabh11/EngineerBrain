import tree_sitter_java as tsjava
from tree_sitter import Language, Node, Parser

from app.parsers.base import BaseParser, ParsedFile, ParsedImport, ParsedSymbol, SymbolKind

JAVA_LANGUAGE = Language(tsjava.language())

_COMMENT_TYPES = ("block_comment", "line_comment")


def _text(node: Node, source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _clean_comment(raw: str) -> str | None:
    text = raw.strip()
    if text.startswith("/*"):
        inner = text[2:-2] if text.endswith("*/") else text[2:]
        lines = [line.strip().lstrip("*").strip() for line in inner.splitlines()]
        return "\n".join(line for line in lines if line).strip() or None
    if text.startswith("//"):
        return text.lstrip("/").strip() or None
    return None


def _leading_comment(node: Node, source: bytes) -> str | None:
    parent = node.parent
    if parent is None:
        return None
    siblings = parent.children
    idx = siblings.index(node)
    if idx == 0:
        return None
    prev = siblings[idx - 1]
    if prev.type not in _COMMENT_TYPES:
        return None
    return _clean_comment(_text(prev, source))


def _annotations(node: Node, source: bytes) -> list[str]:
    modifiers = next((c for c in node.children if c.type == "modifiers"), None)
    if modifiers is None:
        return []
    return [_text(c, source) for c in modifiers.children if c.type in ("marker_annotation", "annotation")]


def _signature(node: Node, source: bytes) -> str:
    body = node.child_by_field_name("body")
    end_byte = body.start_byte if body is not None else node.end_byte
    return source[node.start_byte : end_byte].decode("utf-8", errors="replace").rstrip("{; \n\t")


def _type_names(list_node: Node | None, source: bytes) -> list[str]:
    if list_node is None:
        return []
    return [_text(c, source) for c in list_node.children if c.type != ","]


def _extract_method(node: Node, source: bytes, kind: SymbolKind) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    annotations = _annotations(node, source)
    return ParsedSymbol(
        kind=kind,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        signature=_signature(node, source),
        doc_comment=_leading_comment(node, source),
        metadata={"decorators": annotations} if annotations else {},
    )


def _extract_class(node: Node, source: bytes) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    body_node = node.child_by_field_name("body")
    superclass_node = node.child_by_field_name("superclass")
    interfaces_node = node.child_by_field_name("interfaces")

    superclasses: list[str] = []
    if superclass_node is not None:
        type_id = next((c for c in superclass_node.children if c.type != "extends"), None)
        if type_id is not None:
            superclasses.append(_text(type_id, source))

    interfaces: list[str] = []
    if interfaces_node is not None:
        type_list = next((c for c in interfaces_node.children if c.type == "type_list"), None)
        interfaces.extend(_type_names(type_list, source))

    methods: list[ParsedSymbol] = []
    if body_node is not None:
        for child in body_node.children:
            if child.type in ("method_declaration", "constructor_declaration"):
                methods.append(_extract_method(child, source, SymbolKind.METHOD))

    metadata: dict = {}
    annotations = _annotations(node, source)
    if annotations:
        metadata["decorators"] = annotations
    if superclasses:
        metadata["superclasses"] = ", ".join(superclasses)
    if interfaces:
        metadata["interfaces"] = ", ".join(interfaces)

    return ParsedSymbol(
        kind=SymbolKind.CLASS,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        signature=_signature(node, source),
        doc_comment=_leading_comment(node, source),
        metadata=metadata,
        children=methods,
    )


def _extract_interface(node: Node, source: bytes) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    body_node = node.child_by_field_name("body")
    extends_node = next((c for c in node.children if c.type == "extends_interfaces"), None)

    interfaces: list[str] = []
    if extends_node is not None:
        type_list = next((c for c in extends_node.children if c.type == "type_list"), None)
        interfaces.extend(_type_names(type_list, source))

    methods: list[ParsedSymbol] = []
    if body_node is not None:
        for child in body_node.children:
            if child.type == "method_declaration":
                methods.append(_extract_method(child, source, SymbolKind.METHOD))

    return ParsedSymbol(
        kind=SymbolKind.INTERFACE,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        signature=_signature(node, source),
        doc_comment=_leading_comment(node, source),
        metadata={"interfaces": ", ".join(interfaces)} if interfaces else {},
        children=methods,
    )


def _extract_import(node: Node, source: bytes) -> ParsedImport | None:
    if node.type != "import_declaration":
        return None

    scoped = next((c for c in node.children if c.type in ("scoped_identifier", "identifier")), None)
    if scoped is None:
        return None

    module = _text(scoped, source)
    if any(c.type == "asterisk" for c in node.children):
        module = f"{module}.*"

    return ParsedImport(module=module)


class JavaParser(BaseParser):
    language = "java"
    file_extensions = (".java",)

    def __init__(self) -> None:
        self._parser = Parser(JAVA_LANGUAGE)

    def parse(self, file_path: str, source_code: bytes) -> ParsedFile:
        tree = self._parser.parse(source_code)
        root = tree.root_node

        imports: list[ParsedImport] = []
        symbols: list[ParsedSymbol] = []

        for child in root.children:
            imp = _extract_import(child, source_code)
            if imp is not None:
                imports.append(imp)
            elif child.type == "class_declaration":
                symbols.append(_extract_class(child, source_code))
            elif child.type == "interface_declaration":
                symbols.append(_extract_interface(child, source_code))

        module_doc = None
        if root.children and root.children[0].type in _COMMENT_TYPES:
            module_doc = _clean_comment(_text(root.children[0], source_code))

        return ParsedFile(
            path=file_path,
            language=self.language,
            lines_of_code=len(source_code.splitlines()),
            imports=imports,
            symbols=symbols,
            module_doc_comment=module_doc,
        )
