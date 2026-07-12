import re
from collections import defaultdict

from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding

LONG_METHOD_LINES = 50
LONG_METHOD_COMPLEXITY = 10
LARGE_CLASS_LINES = 300
LARGE_CLASS_METHODS = 15
DEEP_NESTING_THRESHOLD = 4
LARGE_FILE_LINES = 500
MIN_DUPLICATE_LINES = 5


def _function_name(node, source: bytes) -> str:
    name_node = node.child_by_field_name("name")
    if name_node is not None:
        return ast_utils.node_text(name_node, source)
    return "<anonymous>"


class ComplexityAnalyzer:
    name = "complexity"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                complexity = ast_utils.cyclomatic_complexity(func_node, profile)
                if complexity <= LONG_METHOD_COMPLEXITY:
                    continue
                name = _function_name(func_node, file.source)
                findings.append(
                    RawFinding(
                        category="QUALITY",
                        type="HIGH_COMPLEXITY",
                        severity="HIGH" if complexity > 20 else "MEDIUM",
                        title=f"`{name}` has high cyclomatic complexity ({complexity})",
                        explanation=(
                            f"Function `{name}` has a cyclomatic complexity of {complexity}, meaning there are "
                            f"{complexity} distinct paths through it. Above {LONG_METHOD_COMPLEXITY}, functions become "
                            "hard to test exhaustively and reason about."
                        ),
                        suggested_fix="Extract branches into smaller, well-named helper functions so each piece has a single, testable responsibility.",
                        confidence=100,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"complexity": complexity},
                    )
                )
        return findings


class FunctionSizeAnalyzer:
    name = "function_size"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                lines = func_node.end_point[0] - func_node.start_point[0] + 1
                if lines <= LONG_METHOD_LINES:
                    continue
                name = _function_name(func_node, file.source)
                findings.append(
                    RawFinding(
                        category="QUALITY",
                        type="LONG_METHOD",
                        severity="MEDIUM" if lines <= 100 else "HIGH",
                        title=f"`{name}` is a long method ({lines} lines)",
                        explanation=(
                            f"Function `{name}` spans {lines} lines. Long methods tend to do too much, making them "
                            "harder to understand, test, and reuse in isolation."
                        ),
                        suggested_fix="Split into smaller functions, each handling one clear step of the overall task.",
                        confidence=100,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"lines": lines},
                    )
                )
        return findings


class ClassSizeAnalyzer:
    name = "class_size"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            for symbol in file.parsed.symbols:
                if symbol.kind.value != "CLASS":
                    continue
                lines = symbol.end_line - symbol.start_line + 1
                method_count = sum(1 for child in symbol.children if child.kind.value == "METHOD")
                if lines <= LARGE_CLASS_LINES and method_count <= LARGE_CLASS_METHODS:
                    continue
                findings.append(
                    RawFinding(
                        category="QUALITY",
                        type="LARGE_CLASS",
                        severity="MEDIUM" if lines <= 500 else "HIGH",
                        title=f"`{symbol.name}` is a large class ({lines} lines, {method_count} methods)",
                        explanation=(
                            f"Class `{symbol.name}` has {lines} lines and {method_count} methods. Large classes "
                            "often accumulate multiple, unrelated responsibilities over time."
                        ),
                        suggested_fix="Consider splitting into smaller, focused classes grouped by responsibility.",
                        confidence=100,
                        file_path=file.path,
                        start_line=symbol.start_line,
                        end_line=symbol.end_line,
                        symbol_name=symbol.name,
                        metadata={"lines": lines, "method_count": method_count},
                    )
                )
        return findings


class NestingDepthAnalyzer:
    name = "nesting_depth"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                depth = ast_utils.max_nesting_depth(func_node, profile)
                if depth <= DEEP_NESTING_THRESHOLD:
                    continue
                name = _function_name(func_node, file.source)
                findings.append(
                    RawFinding(
                        category="QUALITY",
                        type="DEEP_NESTING",
                        severity="MEDIUM",
                        title=f"`{name}` has deeply nested control flow ({depth} levels)",
                        explanation=(
                            f"Function `{name}` nests control-flow blocks {depth} levels deep, beyond the "
                            f"{DEEP_NESTING_THRESHOLD}-level guideline. Deep nesting is hard to read and easy to get wrong."
                        ),
                        suggested_fix="Use early returns / guard clauses to flatten the nesting, or extract inner blocks into helper functions.",
                        confidence=100,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"depth": depth},
                    )
                )
        return findings


class FileSizeAnalyzer:
    name = "file_size"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            lines = file.parsed.lines_of_code
            if lines <= LARGE_FILE_LINES:
                continue
            findings.append(
                RawFinding(
                    category="QUALITY",
                    type="LARGE_FILE",
                    severity="LOW" if lines <= 1000 else "MEDIUM",
                    title=f"{file.path} is a large file ({lines} lines)",
                    explanation=f"This file has {lines} lines. Large files are harder to navigate and often mix unrelated concerns.",
                    suggested_fix="Split into smaller modules grouped by responsibility.",
                    confidence=100,
                    file_path=file.path,
                    start_line=1,
                    end_line=lines,
                    metadata={"lines": lines},
                )
            )
        return findings


class DuplicateLogicAnalyzer:
    name = "duplicate_logic"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        groups: dict[str, list[tuple]] = defaultdict(list)

        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                lines = func_node.end_point[0] - func_node.start_point[0] + 1
                if lines < MIN_DUPLICATE_LINES:
                    continue
                fingerprint = ast_utils.structural_fingerprint(func_node)
                name = _function_name(func_node, file.source)
                groups[fingerprint].append((file.path, name, func_node.start_point[0] + 1, func_node.end_point[0] + 1))

        findings: list[RawFinding] = []
        for members in groups.values():
            if len(members) < 2:
                continue
            locations = ", ".join(f"{path}:{start}" for path, _name, start, _end in members)
            first_path, first_name, first_start, first_end = members[0]
            findings.append(
                RawFinding(
                    category="QUALITY",
                    type="DUPLICATE_LOGIC",
                    severity="MEDIUM",
                    title=f"Duplicate logic found in {len(members)} functions",
                    explanation=(
                        f"These {len(members)} functions have identical control-flow structure, suggesting "
                        f"copy-pasted logic: {locations}."
                    ),
                    suggested_fix="Extract the shared logic into a single reusable function and call it from each location.",
                    confidence=90,
                    file_path=first_path,
                    start_line=first_start,
                    end_line=first_end,
                    symbol_name=first_name,
                    metadata={"locations": [{"file_path": p, "name": n, "start_line": s, "end_line": e} for p, n, s, e in members]},
                )
            )
        return findings


_IGNORED_VARIABLE_NAMES = frozenset({"_", "self", "this", "cls"})


def _assignment_targets(function_node, language: str, source: bytes) -> list[tuple[str, object]]:
    """Simple `name = expr` (Python) / `let|const|var name = expr` (JS/TS)
    local-variable declarations inside a function - destructuring, tuple
    unpacking, and attribute targets are deliberately excluded since "is this
    used elsewhere" isn't a meaningful question for those."""
    target_node_type = "assignment" if language == "python" else "variable_declarator"
    field_name = "left" if language == "python" else "name"

    targets: list[tuple[str, object]] = []

    def walk(node) -> None:
        if node.type == target_node_type:
            name_node = node.child_by_field_name(field_name)
            if name_node is not None and name_node.type == "identifier":
                targets.append((ast_utils.node_text(name_node, source), name_node))
        for child in node.children:
            walk(child)

    walk(function_node)
    return targets


class UnusedVariableAnalyzer:
    """Structural, not a proxy: a local variable assigned exactly once and
    never read again anywhere else in its own function is unambiguously dead,
    regardless of language conventions - unlike unused-import detection this
    needs no cross-file call graph, since the whole check stays within one
    function's own AST."""

    name = "unused_variables"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            if file.language not in ("python", "javascript", "typescript"):
                continue
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                func_name = _function_name(func_node, file.source)
                body_text = ast_utils.node_text(func_node, file.source)
                for var_name, name_node in _assignment_targets(func_node, file.language, file.source):
                    if var_name in _IGNORED_VARIABLE_NAMES or var_name.startswith("_"):
                        continue
                    total_occurrences = len(re.findall(rf"\b{re.escape(var_name)}\b", body_text))
                    if total_occurrences > 1:
                        continue
                    findings.append(
                        RawFinding(
                            category="QUALITY",
                            type="UNUSED_VARIABLE",
                            severity="LOW",
                            title=f"Unused variable `{var_name}` in `{func_name}`",
                            explanation=(
                                f"`{var_name}` is assigned in `{func_name}` but never read afterwards in the same function."
                            ),
                            suggested_fix="Remove the assignment, or prefix the name with an underscore if it's intentionally unused.",
                            confidence=75,
                            file_path=file.path,
                            start_line=name_node.start_point[0] + 1,
                            end_line=name_node.end_point[0] + 1,
                            symbol_name=func_name,
                            metadata={"variable_name": var_name},
                        )
                    )
        return findings


class UnusedImportAnalyzer:
    """Proxy for dead code: a real unused-function detector needs a resolved
    call graph (GraphEdgeType.CALLS isn't populated yet); unused imports are a
    tractable, deterministic subset of the same "dead code" concern."""

    name = "unused_imports"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            try:
                text = file.source.decode("utf-8", errors="replace")
            except Exception:
                continue

            for imp in file.parsed.imports:
                for imported_name in imp.imported_names:
                    bare_name = imported_name.split(" as ")[-1].split(".")[-1].strip("* ")
                    if not bare_name or not bare_name.isidentifier():
                        continue
                    occurrences = len(re.findall(rf"\b{re.escape(bare_name)}\b", text))
                    if occurrences > 1:
                        continue
                    findings.append(
                        RawFinding(
                            category="QUALITY",
                            type="UNUSED_IMPORT",
                            severity="LOW",
                            title=f"Unused import `{bare_name}` in {file.path}",
                            explanation=f"`{bare_name}` is imported from `{imp.module}` but never referenced elsewhere in this file.",
                            suggested_fix="Remove the unused import.",
                            confidence=80,
                            file_path=file.path,
                            metadata={"import_name": bare_name, "module": imp.module},
                        )
                    )
        return findings
