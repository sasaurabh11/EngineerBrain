import re

import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
from tree_sitter import Language, Node, Parser

from app.parsers.base import BaseParser, ParsedFile, ParsedImport, ParsedRoute, ParsedSymbol, SymbolKind

JAVASCRIPT_LANGUAGE = Language(tsjs.language())
TYPESCRIPT_LANGUAGE = Language(tsts.language_typescript())
TSX_LANGUAGE = Language(tsts.language_tsx())

_VARIABLE_DECLARATION_TYPES = ("lexical_declaration", "variable_declaration")

_HTTP_METHODS = {"get": "GET", "post": "POST", "put": "PUT", "delete": "DELETE", "patch": "PATCH", "all": "ANY"}
_ROUTER_OBJECT_NAME = re.compile(r"(router|app)$", re.I)


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


def _leading_comment(anchor: Node, source: bytes) -> str | None:
    parent = anchor.parent
    if parent is None:
        return None
    siblings = parent.children
    idx = siblings.index(anchor)
    if idx == 0:
        return None
    prev = siblings[idx - 1]
    if prev.type != "comment":
        return None
    return _clean_comment(_text(prev, source))


def _decorators(anchor: Node, source: bytes) -> list[str]:
    """Decorators show up either as leading children of the decorated node itself
    (bare `@Dec() class Foo {}`) or as leading siblings (exported classes, class
    members inside a class_body). Check both shapes."""
    leading_children = []
    for child in anchor.children:
        if child.type == "decorator":
            leading_children.append(_text(child, source))
        else:
            break
    if leading_children:
        return leading_children

    parent = anchor.parent
    if parent is None:
        return []
    siblings = parent.children
    idx = siblings.index(anchor)
    result: list[str] = []
    i = idx - 1
    while i >= 0 and siblings[i].type == "decorator":
        result.insert(0, _text(siblings[i], source))
        i -= 1
    return result


def _signature(node: Node, source: bytes) -> str:
    body = node.child_by_field_name("body")
    end_byte = body.start_byte if body is not None else node.end_byte
    return source[node.start_byte : end_byte].decode("utf-8", errors="replace").rstrip("{ \n\t")


def _string_value(string_node: Node, source: bytes) -> str:
    fragment = next((c for c in string_node.children if c.type == "string_fragment"), None)
    if fragment is not None:
        return _text(fragment, source)
    return _text(string_node, source).strip("\"'`")


def _extract_require_imports(decl_node: Node, source: bytes) -> list[ParsedImport]:
    """CommonJS `const x = require("y")` / `const { a, b } = require("y")` - ubiquitous in Node.js/Express code."""
    imports: list[ParsedImport] = []
    for declarator in decl_node.children:
        if declarator.type != "variable_declarator":
            continue
        value = declarator.child_by_field_name("value")
        if value is None or value.type != "call_expression":
            continue
        func_node = value.child_by_field_name("function")
        if func_node is None or _text(func_node, source) != "require":
            continue
        args_node = value.child_by_field_name("arguments")
        if args_node is None:
            continue
        string_node = next((c for c in args_node.children if c.type == "string"), None)
        if string_node is None:
            continue
        module = _string_value(string_node, source)

        imported_names: list[str] = []
        name_node = declarator.child_by_field_name("name")
        if name_node is not None:
            if name_node.type == "identifier":
                imported_names.append(_text(name_node, source))
            elif name_node.type == "object_pattern":
                for child in name_node.children:
                    if child.type == "shorthand_property_identifier_pattern":
                        imported_names.append(_text(child, source))
                    elif child.type == "pair_pattern":
                        key = child.child_by_field_name("key")
                        if key is not None:
                            imported_names.append(_text(key, source))

        imports.append(ParsedImport(module=module, imported_names=imported_names))
    return imports


def _extract_import(node: Node, source: bytes) -> ParsedImport | None:
    if node.type != "import_statement":
        return None

    source_node = node.child_by_field_name("source")
    if source_node is None:
        return None
    module = _string_value(source_node, source)

    imported_names: list[str] = []
    clause = next((c for c in node.children if c.type == "import_clause"), None)
    if clause is not None:
        for child in clause.children:
            if child.type == "identifier":
                imported_names.append(_text(child, source))
            elif child.type == "namespace_import":
                ns_name = child.children[-1]
                imported_names.append(f"* as {_text(ns_name, source)}")
            elif child.type == "named_imports":
                for spec in child.children:
                    if spec.type != "import_specifier":
                        continue
                    name_node = spec.child_by_field_name("name")
                    alias_node = spec.child_by_field_name("alias")
                    if alias_node is not None and name_node is not None:
                        imported_names.append(f"{_text(name_node, source)} as {_text(alias_node, source)}")
                    elif name_node is not None:
                        imported_names.append(_text(name_node, source))

    return ParsedImport(module=module, imported_names=imported_names)


def _class_heritage(class_node: Node, source: bytes) -> tuple[list[str], list[str]]:
    heritage = next((c for c in class_node.children if c.type == "class_heritage"), None)
    if heritage is None:
        return [], []

    superclasses: list[str] = []
    interfaces: list[str] = []

    extends_clause = next((c for c in heritage.children if c.type == "extends_clause"), None)
    implements_clause = next((c for c in heritage.children if c.type == "implements_clause"), None)

    if extends_clause is not None:
        value = extends_clause.child_by_field_name("value")
        if value is not None:
            superclasses.append(_text(value, source))
    if implements_clause is not None:
        interfaces.extend(
            _text(c, source) for c in implements_clause.children if c.type in ("type_identifier", "identifier", "generic_type")
        )

    if extends_clause is None and implements_clause is None:
        children = heritage.children
        for i, child in enumerate(children):
            if child.type == "extends" and i + 1 < len(children):
                superclasses.append(_text(children[i + 1], source))

    return superclasses, interfaces


def _extract_function_like(node: Node, source: bytes, kind: SymbolKind, comment_anchor: Node, name: str | None = None) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    resolved_name = name or (_text(name_node, source) if name_node else "<anonymous>")
    decorators = _decorators(comment_anchor, source)

    return ParsedSymbol(
        kind=kind,
        name=resolved_name,
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        signature=_signature(node, source),
        doc_comment=_leading_comment(comment_anchor, source),
        metadata={"decorators": decorators} if decorators else {},
    )


def _extract_variable_functions(decl_node: Node, source: bytes, comment_anchor: Node) -> list[ParsedSymbol]:
    symbols: list[ParsedSymbol] = []
    for declarator in decl_node.children:
        if declarator.type != "variable_declarator":
            continue
        value = declarator.child_by_field_name("value")
        if value is None or value.type not in ("arrow_function", "function_expression"):
            continue

        name_node = declarator.child_by_field_name("name")
        name = _text(name_node, source) if name_node else "<anonymous>"
        body = value.child_by_field_name("body")
        end_byte = body.start_byte if body is not None and body.type == "statement_block" else value.end_byte
        signature = source[decl_node.start_byte : end_byte].decode("utf-8", errors="replace").rstrip("{ \n\t")

        symbols.append(
            ParsedSymbol(
                kind=SymbolKind.FUNCTION,
                name=name,
                start_line=decl_node.start_point[0] + 1,
                end_line=decl_node.end_point[0] + 1,
                signature=signature,
                doc_comment=_leading_comment(comment_anchor, source),
            )
        )
    return symbols


def _extract_class(node: Node, source: bytes, comment_anchor: Node) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    body_node = node.child_by_field_name("body")
    superclasses, interfaces = _class_heritage(node, source)

    methods: list[ParsedSymbol] = []
    if body_node is not None:
        for child in body_node.children:
            if child.type == "method_definition":
                methods.append(_extract_function_like(child, source, SymbolKind.METHOD, comment_anchor=child))

    metadata: dict = {}
    decorators = _decorators(comment_anchor, source)
    if decorators:
        metadata["decorators"] = decorators
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
        doc_comment=_leading_comment(comment_anchor, source),
        metadata=metadata,
        children=methods,
    )


def _extract_interface(node: Node, source: bytes, comment_anchor: Node) -> ParsedSymbol:
    name_node = node.child_by_field_name("name")
    return ParsedSymbol(
        kind=SymbolKind.INTERFACE,
        name=_text(name_node, source) if name_node else "<anonymous>",
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        signature=_signature(node, source),
        doc_comment=_leading_comment(comment_anchor, source),
    )


def _collect_routes(node: Node, source: bytes, routes: list[ParsedRoute]) -> None:
    """Finds imperative Express-style route registrations: `router.get("/x", ...)` /
    `app.post("/y", ...)`. Decorator-based routes (NestJS/Spring/FastAPI) are handled
    separately since they attach to a symbol rather than a bare call expression."""
    if node.type == "call_expression":
        func = node.child_by_field_name("function")
        if func is not None and func.type == "member_expression":
            obj = func.child_by_field_name("object")
            prop = func.child_by_field_name("property")
            if obj is not None and prop is not None and obj.type == "identifier":
                http_method = _HTTP_METHODS.get(_text(prop, source).lower())
                if http_method is not None and _ROUTER_OBJECT_NAME.search(_text(obj, source)):
                    args = node.child_by_field_name("arguments")
                    first_arg = next(
                        (c for c in (args.children if args is not None else []) if c.type not in ("(", ")", ",")),
                        None,
                    )
                    if first_arg is not None and first_arg.type == "string":
                        path = _string_value(first_arg, source)
                        if path.startswith("/"):
                            routes.append(ParsedRoute(method=http_method, path=path, line=node.start_point[0] + 1))

    for child in node.children:
        _collect_routes(child, source, routes)


class _JsFamilyParser(BaseParser):
    def __init__(self, language: str, ts_language: Language, file_extensions: tuple[str, ...]) -> None:
        self.language = language
        self.file_extensions = file_extensions
        self._parser = Parser(ts_language)

    def parse(self, file_path: str, source_code: bytes) -> ParsedFile:
        tree = self._parser.parse(source_code)
        root = tree.root_node

        imports: list[ParsedImport] = []
        symbols: list[ParsedSymbol] = []

        for top_node in root.children:
            if top_node.type == "export_statement":
                inner = top_node.child_by_field_name("declaration")
                if inner is None:
                    continue
                anchor = top_node
            else:
                inner = top_node
                anchor = top_node

            imp = _extract_import(inner, source_code)
            if imp is not None:
                imports.append(imp)
                continue

            if inner.type == "function_declaration":
                symbols.append(_extract_function_like(inner, source_code, SymbolKind.FUNCTION, comment_anchor=anchor))
            elif inner.type == "class_declaration":
                symbols.append(_extract_class(inner, source_code, comment_anchor=anchor))
            elif inner.type == "interface_declaration":
                symbols.append(_extract_interface(inner, source_code, comment_anchor=anchor))
            elif inner.type in _VARIABLE_DECLARATION_TYPES:
                imports.extend(_extract_require_imports(inner, source_code))
                symbols.extend(_extract_variable_functions(inner, source_code, comment_anchor=anchor))

        module_doc = None
        if root.children and root.children[0].type == "comment":
            module_doc = _clean_comment(_text(root.children[0], source_code))

        routes: list[ParsedRoute] = []
        _collect_routes(root, source_code, routes)

        return ParsedFile(
            path=file_path,
            language=self.language,
            lines_of_code=len(source_code.splitlines()),
            imports=imports,
            symbols=symbols,
            routes=routes,
            module_doc_comment=module_doc,
        )


class JavaScriptParser(_JsFamilyParser):
    def __init__(self) -> None:
        super().__init__("javascript", JAVASCRIPT_LANGUAGE, (".js", ".jsx", ".mjs", ".cjs"))


class TypeScriptParser(_JsFamilyParser):
    def __init__(self) -> None:
        super().__init__("typescript", TYPESCRIPT_LANGUAGE, (".ts", ".mts", ".cts"))


class TsxParser(_JsFamilyParser):
    def __init__(self) -> None:
        super().__init__("typescript", TSX_LANGUAGE, (".tsx",))
