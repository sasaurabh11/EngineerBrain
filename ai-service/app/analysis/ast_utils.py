import hashlib
from dataclasses import dataclass

import tree_sitter_java as tsjava
import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Node, Parser

PYTHON_LANGUAGE = Language(tspython.language())
JAVASCRIPT_LANGUAGE = Language(tsjavascript.language())
TYPESCRIPT_LANGUAGE = Language(tstypescript.language_typescript())
JAVA_LANGUAGE = Language(tsjava.language())


@dataclass(frozen=True)
class LanguageProfile:
    decision_node_types: frozenset[str]
    logical_operator_texts: frozenset[str]
    nesting_node_types: frozenset[str]
    loop_node_types: frozenset[str]
    call_node_types: frozenset[str]
    function_node_types: frozenset[str]


_PYTHON_PROFILE = LanguageProfile(
    decision_node_types=frozenset(
        {"if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "conditional_expression", "case_clause"}
    ),
    logical_operator_texts=frozenset({"and", "or"}),
    nesting_node_types=frozenset({"if_statement", "for_statement", "while_statement", "try_statement", "with_statement", "match_statement"}),
    loop_node_types=frozenset({"for_statement", "while_statement"}),
    call_node_types=frozenset({"call"}),
    function_node_types=frozenset({"function_definition"}),
)

_JS_PROFILE = LanguageProfile(
    decision_node_types=frozenset(
        {"if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "catch_clause", "switch_case", "ternary_expression"}
    ),
    logical_operator_texts=frozenset({"&&", "||", "??"}),
    nesting_node_types=frozenset(
        {"if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "try_statement", "switch_statement"}
    ),
    loop_node_types=frozenset({"for_statement", "for_in_statement", "while_statement", "do_statement"}),
    call_node_types=frozenset({"call_expression"}),
    function_node_types=frozenset({"function_declaration", "method_definition", "arrow_function", "function_expression"}),
)

_JAVA_PROFILE = LanguageProfile(
    decision_node_types=frozenset(
        {"if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "catch_clause", "switch_label", "ternary_expression"}
    ),
    logical_operator_texts=frozenset({"&&", "||"}),
    nesting_node_types=frozenset(
        {"if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "try_statement", "switch_expression"}
    ),
    loop_node_types=frozenset({"for_statement", "enhanced_for_statement", "while_statement", "do_statement"}),
    call_node_types=frozenset({"method_invocation"}),
    function_node_types=frozenset({"method_declaration", "constructor_declaration"}),
)

_PARSERS: dict[str, tuple[Parser, LanguageProfile]] = {
    "python": (Parser(PYTHON_LANGUAGE), _PYTHON_PROFILE),
    "javascript": (Parser(JAVASCRIPT_LANGUAGE), _JS_PROFILE),
    "typescript": (Parser(TYPESCRIPT_LANGUAGE), _JS_PROFILE),
    "java": (Parser(JAVA_LANGUAGE), _JAVA_PROFILE),
}


def get_profile(language: str) -> LanguageProfile | None:
    entry = _PARSERS.get(language)
    return entry[1] if entry else None


def parse_raw_tree(language: str, source: bytes) -> Node | None:
    entry = _PARSERS.get(language)
    if entry is None:
        return None
    parser, _ = entry
    return parser.parse(source).root_node


def node_text(node: Node, source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def is_logical_operator(node: Node, profile: LanguageProfile) -> bool:
    if node.type == "boolean_operator":
        return True
    if node.type != "binary_expression":
        return False
    operator = node.child_by_field_name("operator")
    return operator is not None and operator.type in profile.logical_operator_texts


def cyclomatic_complexity(function_node: Node, profile: LanguageProfile) -> int:
    """McCabe complexity: 1 + decision points + logical operators in conditions."""
    complexity = 1

    def walk(node: Node) -> None:
        nonlocal complexity
        if node.type in profile.decision_node_types:
            complexity += 1
        if is_logical_operator(node, profile):
            complexity += 1
        for child in node.children:
            walk(child)

    walk(function_node)
    return complexity


def max_nesting_depth(function_node: Node, profile: LanguageProfile) -> int:
    def walk(node: Node, depth: int) -> int:
        deepest = depth
        for child in node.children:
            child_depth = depth + 1 if child.type in profile.nesting_node_types else depth
            deepest = max(deepest, walk(child, child_depth))
        return deepest

    return walk(function_node, 0)


def max_loop_nesting_depth(function_node: Node, profile: LanguageProfile) -> int:
    """Like max_nesting_depth but only counts loop-within-loop nesting (the
    specific shape that risks O(n^2)+ behavior), ignoring if/try/switch blocks."""

    def walk(node: Node, depth: int) -> int:
        deepest = depth
        for child in node.children:
            child_depth = depth + 1 if child.type in profile.loop_node_types else depth
            deepest = max(deepest, walk(child, child_depth))
        return deepest

    return walk(function_node, 0)


def is_async_function(function_node: Node, source: bytes) -> bool:
    prefix = source[function_node.start_byte : function_node.start_byte + 20].decode("utf-8", errors="replace").lstrip()
    return prefix.startswith("async")


def nodes_within(function_node: Node, loop_node_types: frozenset[str]) -> list[Node]:
    """All loop nodes anywhere under `function_node`."""
    found: list[Node] = []

    def walk(node: Node) -> None:
        if node.type in loop_node_types:
            found.append(node)
        for child in node.children:
            walk(child)

    walk(function_node)
    return found


def contains_loop(node: Node, profile: LanguageProfile) -> bool:
    if node.type in profile.loop_node_types:
        return True
    return any(contains_loop(child, profile) for child in node.children)


def find_function_nodes(root: Node, profile: LanguageProfile) -> list[Node]:
    found: list[Node] = []

    def walk(node: Node) -> None:
        if node.type in profile.function_node_types:
            found.append(node)
        for child in node.children:
            walk(child)

    walk(root)
    return found


def _callee_name(call_node: Node, source: bytes) -> str | None:
    name_field = call_node.child_by_field_name("name")
    if name_field is not None:
        return node_text(name_field, source)

    func_field = call_node.child_by_field_name("function")
    if func_field is None:
        return None
    if func_field.type in ("attribute", "member_expression"):
        prop = func_field.child_by_field_name("attribute") or func_field.child_by_field_name("property")
        return node_text(prop, source) if prop is not None else None
    return node_text(func_field, source)


def find_calls(node: Node, profile: LanguageProfile, source: bytes) -> list[tuple[str, Node]]:
    """(callee_name, call_node) pairs for every call expression under `node`."""
    calls: list[tuple[str, Node]] = []

    def walk(n: Node) -> None:
        if n.type in profile.call_node_types:
            name = _callee_name(n, source)
            if name is not None:
                calls.append((name, n))
        for child in n.children:
            walk(child)

    walk(node)
    return calls


_HALSTEAD_OPERAND_NAMED_TYPES = frozenset(
    {
        "identifier", "property_identifier", "type_identifier", "field_identifier", "shorthand_property_identifier",
        "string", "string_content", "string_fragment", "number", "integer", "float", "decimal_integer_literal",
        "true", "false", "null", "none",
    }
)
_HALSTEAD_SKIP_LEAF_TYPES = frozenset({"(", ")", "{", "}", "[", "]", ",", ";", ":", ".", '"', "'", "`"})


def count_operators_and_operands(function_node: Node, source: bytes) -> tuple[int, int, int, int]:
    """Halstead primitives via leaf-token classification: named identifier/literal
    leaves are operands (counted by distinct value); anonymous keyword/symbol
    leaves (if, for, +, ==, &&, ...) are operators (counted by distinct token type,
    which for tree-sitter's anonymous tokens is the literal text itself)."""
    distinct_operators: set[str] = set()
    distinct_operands: set[str] = set()
    total_operators = 0
    total_operands = 0

    def walk(node: Node) -> None:
        nonlocal total_operators, total_operands
        if node.child_count == 0:
            if node.is_named and node.type in _HALSTEAD_OPERAND_NAMED_TYPES:
                distinct_operands.add(node_text(node, source))
                total_operands += 1
            elif not node.is_named and node.type not in _HALSTEAD_SKIP_LEAF_TYPES:
                distinct_operators.add(node.type)
                total_operators += 1
            return
        for child in node.children:
            walk(child)

    walk(function_node)
    return len(distinct_operators), len(distinct_operands), total_operators, total_operands


def structural_fingerprint(function_node: Node) -> str:
    """Hashes a function's node-type shape, ignoring identifier/literal text -
    two functions with the same fingerprint have identical control-flow structure
    even if variable names differ (copy-paste-then-rename duplicates)."""
    parts: list[str] = []

    def walk(node: Node) -> None:
        parts.append(node.type)
        for child in node.children:
            walk(child)

    walk(function_node)
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
