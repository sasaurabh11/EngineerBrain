import re

from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding

SRP_METHOD_THRESHOLD = 10
SRP_LOC_THRESHOLD = 200
OCP_BRANCH_THRESHOLD = 4
ISP_TRIVIAL_METHOD_THRESHOLD = 2
_CONSTRUCTOR_NAMES = frozenset({"__init__", "constructor"})

_TRIVIAL_BODY_RE = re.compile(
    r"^(pass|\.\.\.|raise\s+NotImplementedError|throw\s+new\s+\w*Error|throw\s+new\s+UnsupportedOperationException)",
    re.IGNORECASE,
)
_COMMENT_PREFIXES = ("//", "#", "*", "/*")


def _is_trivial_body(file, symbol) -> bool:
    """A body that's essentially just `pass`/`raise`/`throw` - nothing else."""
    lines = file.source.decode("utf-8", errors="replace").splitlines()
    body_lines = [
        line.strip()
        for line in lines[symbol.start_line : symbol.end_line - 1]
        if line.strip() and not line.strip().startswith(_COMMENT_PREFIXES)
    ]
    if not body_lines or len(body_lines) > 2:
        return False
    return any(_TRIVIAL_BODY_RE.match(line) for line in body_lines)


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


class OcpCandidateAnalyzer:
    """Structural pre-filter: a long chain of elif/case/switch-label arms
    dispatching on some discriminator is the classic sign that adding a new
    case means modifying this function directly instead of extending behavior
    via polymorphism/strategy - Stage 2 judges whether it's a real concern."""

    name = "ocp_candidates"

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
                arms = ast_utils.count_branch_arms(func_node)
                if arms < OCP_BRANCH_THRESHOLD:
                    continue
                name = _function_name(func_node, file.source)
                findings.append(
                    RawFinding(
                        category="SOLID",
                        type="OCP_CANDIDATE",
                        severity="LOW",
                        title=f"`{name}` has a {arms}-way branch that may violate the Open/Closed Principle",
                        explanation=(
                            f"`{name}` dispatches across {arms} conditional/case branches. Adding a new case means "
                            "modifying this function directly rather than extending behavior without changing existing code."
                        ),
                        confidence=35,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        evidence=f"{arms} branch arms in one function",
                        metadata={"branch_arms": arms},
                    )
                )
        return findings


class LspCandidateAnalyzer:
    """Structural pre-filter: a subclass method whose entire body just throws/
    raises is a classic LSP smell - the subtype refuses part of its parent's
    contract instead of fulfilling it, so it can't be safely substituted."""

    name = "lsp_candidates"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            for symbol in file.parsed.symbols:
                if symbol.kind.value != "CLASS" or not symbol.metadata.get("superclasses"):
                    continue
                for method in symbol.children:
                    if method.kind.value != "METHOD" or not _is_trivial_body(file, method):
                        continue
                    findings.append(
                        RawFinding(
                            category="SOLID",
                            type="LSP_CANDIDATE",
                            severity="MEDIUM",
                            title=f"`{symbol.name}.{method.name}` may violate the Liskov Substitution Principle",
                            explanation=(
                                f"`{method.name}` overrides a method from `{symbol.metadata['superclasses']}` but its "
                                "body only throws/raises - a subtype that refuses part of its parent's contract can't "
                                "be safely substituted wherever the parent type is expected."
                            ),
                            confidence=40,
                            file_path=file.path,
                            start_line=method.start_line,
                            end_line=method.end_line,
                            symbol_name=f"{symbol.name}.{method.name}",
                            evidence="Method body only raises/throws",
                            metadata={
                                "class_name": symbol.name,
                                "method_name": method.name,
                                "superclass": symbol.metadata["superclasses"],
                            },
                        )
                    )
        return findings


class IspCandidateAnalyzer:
    """Structural pre-filter: a class implementing an interface where several
    methods are trivial/empty stubs suggests the interface forces implementers
    to depend on methods they don't use - split it into smaller interfaces."""

    name = "isp_candidates"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            for symbol in file.parsed.symbols:
                if symbol.kind.value != "CLASS" or not symbol.metadata.get("interfaces"):
                    continue
                methods = [c for c in symbol.children if c.kind.value == "METHOD"]
                trivial_methods = [m for m in methods if _is_trivial_body(file, m)]
                if len(trivial_methods) < ISP_TRIVIAL_METHOD_THRESHOLD:
                    continue
                findings.append(
                    RawFinding(
                        category="SOLID",
                        type="ISP_CANDIDATE",
                        severity="LOW",
                        title=f"`{symbol.name}` may violate the Interface Segregation Principle",
                        explanation=(
                            f"`{symbol.name}` implements `{symbol.metadata['interfaces']}` but leaves "
                            f"{len(trivial_methods)} methods essentially empty "
                            f"({', '.join(m.name for m in trivial_methods)}) - a sign the interface forces this class "
                            "to depend on methods it doesn't actually use."
                        ),
                        confidence=35,
                        file_path=file.path,
                        start_line=symbol.start_line,
                        end_line=symbol.end_line,
                        symbol_name=symbol.name,
                        evidence=f"{len(trivial_methods)} trivial/empty method implementations",
                        metadata={
                            "interfaces": symbol.metadata["interfaces"],
                            "trivial_methods": [m.name for m in trivial_methods],
                        },
                    )
                )
        return findings
