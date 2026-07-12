import math

from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding
from app.analysis.dependency import _build_file_graph

_SEVERITY_PENALTY = {"CRITICAL": 12, "HIGH": 6, "MEDIUM": 3, "LOW": 1, "INFO": 0}
_DEFAULT_MAINTAINABILITY = 100
_DEFAULT_SCORE = 100

# Scalability is a narrower slice of PERFORMANCE: only findings that concern
# how behavior degrades under growing load/concurrency (blocking the event
# loop, N+1 queries, unbounded fetches, absent caching), as opposed to
# per-request efficiency concerns like nested loops or large literals which
# `performance_score` already covers in full.
_SCALABILITY_TYPES = frozenset({"BLOCKING_OPERATION", "N_PLUS_ONE_QUERY", "HEAVY_DATABASE_CALL", "MISSING_CACHING"})


def category_score(findings: list[RawFinding], category: str) -> int:
    score = 100
    for finding in findings:
        if finding.category == category:
            score -= _SEVERITY_PENALTY.get(finding.severity, 0)
    return max(0, score)


def type_score(findings: list[RawFinding], types: frozenset[str]) -> int:
    score = 100
    for finding in findings:
        if finding.type in types:
            score -= _SEVERITY_PENALTY.get(finding.severity, 0)
    return max(0, score)


def _maintainability_index(halstead_volume: float, avg_complexity: float, loc: int) -> int:
    safe_volume = max(halstead_volume, 1.0)
    safe_loc = max(loc, 1)
    raw = 171 - 5.2 * math.log(safe_volume) - 0.23 * avg_complexity - 16.2 * math.log(safe_loc)
    normalized = max(0.0, min(100.0, raw * 100 / 171))
    return round(normalized)


def _file_maintainability_index(file) -> int | None:
    """Classic Maintainability Index computed over the whole file: Halstead
    volume from the file's operator/operand vocabulary, cyclomatic complexity
    averaged across its functions, and lines of code."""
    profile = ast_utils.get_profile(file.language)
    if profile is None:
        return None
    root = ast_utils.parse_raw_tree(file.language, file.source)
    if root is None:
        return None

    n1, n2, total_operators, total_operands = ast_utils.count_operators_and_operands(root, file.source)
    volume = (total_operators + total_operands) * math.log2(max(n1 + n2, 2))

    func_nodes = ast_utils.find_function_nodes(root, profile)
    complexities = [ast_utils.cyclomatic_complexity(func_node, profile) for func_node in func_nodes]
    avg_complexity = sum(complexities) / len(complexities) if complexities else 1.0

    return _maintainability_index(volume, avg_complexity, file.parsed.lines_of_code)


def maintainability_score(context: AnalysisContext) -> int:
    scores = [score for score in (_file_maintainability_index(file) for file in context.files) if score is not None]
    if not scores:
        return _DEFAULT_MAINTAINABILITY
    return round(sum(scores) / len(scores))


def modularity_score(context: AnalysisContext) -> int:
    """100 minus a penalty proportional to average per-file coupling (in-degree
    + out-degree in the resolved import graph). Lower average coupling means
    files are more independently understandable and replaceable - the
    practical meaning of "modularity"."""
    graph = _build_file_graph(context)
    if not graph:
        return _DEFAULT_SCORE

    efferent: dict[str, int] = {path: len(targets) for path, targets in graph.items()}
    afferent: dict[str, int] = {}
    for targets in graph.values():
        for target in targets:
            afferent[target] = afferent.get(target, 0) + 1

    all_paths = {f.path for f in context.files}
    if not all_paths:
        return _DEFAULT_SCORE

    total_coupling = sum(efferent.get(path, 0) + afferent.get(path, 0) for path in all_paths)
    avg_coupling = total_coupling / len(all_paths)
    return max(0, min(100, round(100 - avg_coupling * 4)))


def documentation_score(context: AnalysisContext) -> int:
    """Share of classes/functions/methods that carry a doc comment. Modules
    aren't counted - a file without a module docstring is common and not, by
    itself, a documentation gap the way an undocumented public function is."""
    documented = 0
    total = 0

    def walk(symbols) -> None:
        nonlocal documented, total
        for symbol in symbols:
            if symbol.kind.value in ("CLASS", "FUNCTION", "METHOD", "INTERFACE"):
                total += 1
                if symbol.doc_comment:
                    documented += 1
            walk(symbol.children)

    for file in context.files:
        walk(file.parsed.symbols)

    if total == 0:
        return _DEFAULT_SCORE
    return round((documented / total) * 100)


def complexity_score(context: AnalysisContext) -> int:
    """100 minus a penalty proportional to average cyclomatic complexity across
    every function in the repository - a direct, explainable inverse of the
    same complexity metric HIGH_COMPLEXITY findings are based on."""
    complexities: list[int] = []
    for file in context.files:
        profile = ast_utils.get_profile(file.language)
        if profile is None:
            continue
        root = ast_utils.parse_raw_tree(file.language, file.source)
        if root is None:
            continue
        for func_node in ast_utils.find_function_nodes(root, profile):
            complexities.append(ast_utils.cyclomatic_complexity(func_node, profile))

    if not complexities:
        return _DEFAULT_SCORE
    avg_complexity = sum(complexities) / len(complexities)
    return max(0, min(100, round(100 - avg_complexity * 5)))


def technical_debt_score(context: AnalysisContext, findings: list[RawFinding]) -> int:
    """100 minus total severity-weighted findings, normalized by repository
    size (files) so a larger repository with the same issue *density* doesn't
    score worse purely for having more files."""
    debt_points = sum(_SEVERITY_PENALTY.get(f.severity, 0) for f in findings)
    file_count = max(len(context.files), 1)
    normalized = debt_points / file_count
    return max(0, min(100, round(100 - normalized * 10)))


def compute_scores(context: AnalysisContext, findings: list[RawFinding]) -> dict[str, int]:
    architecture = category_score(findings, "DEPENDENCY")
    security = category_score(findings, "SECURITY")
    performance = category_score(findings, "PERFORMANCE")
    maintainability = maintainability_score(context)
    scalability = type_score(findings, _SCALABILITY_TYPES)
    modularity = modularity_score(context)
    layering = type_score(findings, frozenset({"LAYER_VIOLATION"}))
    documentation = documentation_score(context)
    complexity = complexity_score(context)
    technical_debt = technical_debt_score(context, findings)

    overall = round(
        sum([architecture, security, performance, maintainability, documentation, complexity, technical_debt]) / 7
    )

    return {
        "overall_score": overall,
        "architecture_score": architecture,
        "security_score": security,
        "performance_score": performance,
        "maintainability_score": maintainability,
        "scalability_score": scalability,
        "modularity_score": modularity,
        "layering_score": layering,
        "documentation_score": documentation,
        "complexity_score": complexity,
        "technical_debt_score": technical_debt,
    }
