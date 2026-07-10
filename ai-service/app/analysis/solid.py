from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding

SRP_METHOD_THRESHOLD = 10
SRP_LOC_THRESHOLD = 200
_CONSTRUCTOR_NAMES = frozenset({"__init__", "constructor"})


def _function_name(node, source: bytes) -> str:
    name_node = node.child_by_field_name("name")
    return ast_utils.node_text(name_node, source) if name_node is not None else "<anonymous>"


def _find_instantiations(node, language: str, source: bytes) -> list[str]:
    """Structural candidates only - these are heuristic pre-filters, not
    confirmed violations. Stage 2 (AI) judges whether they're actually a problem."""
    results: list[str] = []

    def walk(n) -> None:
        if language in ("javascript", "typescript") and n.type == "new_expression":
            callee = n.child_by_field_name("constructor")
            if callee is not None:
                results.append(ast_utils.node_text(callee, source))
        elif language == "java" and n.type == "object_creation_expression":
            type_node = n.child_by_field_name("type")
            if type_node is not None:
                results.append(ast_utils.node_text(type_node, source))
        elif language == "python" and n.type == "call":
            func = n.child_by_field_name("function")
            if func is not None and func.type == "identifier":
                text = ast_utils.node_text(func, source)
                if text[:1].isupper():
                    results.append(text)
        for child in n.children:
            walk(child)

    walk(node)
    return results


class SrpCandidateAnalyzer:
    """Structural pre-filter only: many methods + many lines is a signal, not
    proof, that a class has too many responsibilities. Emitted at low confidence
    for the Stage 2 AI confirmation pass to judge based on actual cohesion."""

    name = "srp_candidates"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            for symbol in file.parsed.symbols:
                if symbol.kind.value != "CLASS":
                    continue
                methods = [c for c in symbol.children if c.kind.value == "METHOD"]
                lines = symbol.end_line - symbol.start_line + 1
                if len(methods) < SRP_METHOD_THRESHOLD or lines < SRP_LOC_THRESHOLD:
                    continue

                findings.append(
                    RawFinding(
                        category="SOLID",
                        type="SRP_CANDIDATE",
                        severity="MEDIUM",
                        title=f"`{symbol.name}` may violate the Single Responsibility Principle",
                        explanation=(
                            f"Class `{symbol.name}` has {len(methods)} methods across {lines} lines - a structural "
                            "signal it may have multiple responsibilities, though confirming this needs judgment "
                            "about whether the methods form one cohesive purpose."
                        ),
                        confidence=40,
                        file_path=file.path,
                        start_line=symbol.start_line,
                        end_line=symbol.end_line,
                        symbol_name=symbol.name,
                        metadata={"method_count": len(methods), "lines": lines, "method_names": [m.name for m in methods]},
                    )
                )
        return findings


class DipCandidateAnalyzer:
    """Structural pre-filter: a constructor that directly instantiates concrete
    classes rather than receiving them as parameters is a candidate DIP
    violation - Stage 2 confirms whether the coupling is actually problematic."""

    name = "dip_candidates"

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
                name = _function_name(func_node, file.source)
                if name not in _CONSTRUCTOR_NAMES:
                    continue

                instantiations = _find_instantiations(func_node, file.language, file.source)
                if not instantiations:
                    continue

                findings.append(
                    RawFinding(
                        category="SOLID",
                        type="DIP_CANDIDATE",
                        severity="LOW",
                        title=f"`{name}` directly instantiates concrete dependencies",
                        explanation=(
                            f"This constructor creates {', '.join(instantiations)} directly rather than receiving "
                            "them as parameters, coupling this class to specific implementations."
                        ),
                        confidence=40,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"instantiated_types": instantiations},
                    )
                )
        return findings
