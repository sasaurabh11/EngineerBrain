import math

from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding

_SEVERITY_PENALTY = {"CRITICAL": 12, "HIGH": 6, "MEDIUM": 3, "LOW": 1, "INFO": 0}
_DEFAULT_MAINTAINABILITY = 100


def category_score(findings: list[RawFinding], category: str) -> int:
    score = 100
    for finding in findings:
        if finding.category == category:
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


def compute_scores(context: AnalysisContext, findings: list[RawFinding]) -> dict[str, int]:
    architecture = category_score(findings, "DEPENDENCY")
    security = category_score(findings, "SECURITY")
    performance = category_score(findings, "PERFORMANCE")
    maintainability = maintainability_score(context)
    overall = round((architecture + security + performance + maintainability) / 4)

    return {
        "overall_score": overall,
        "architecture_score": architecture,
        "security_score": security,
        "performance_score": performance,
        "maintainability_score": maintainability,
    }
