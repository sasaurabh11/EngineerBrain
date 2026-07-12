from app.analysis.analyzer import RawFinding

_SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}
_RANK_TO_SEVERITY = {v: k for k, v in _SEVERITY_RANK.items()}

_FUNCTION_TYPES = frozenset(
    {
        "HIGH_COMPLEXITY",
        "LONG_METHOD",
        "DEEP_NESTING",
        "N_PLUS_ONE_QUERY",
        "BLOCKING_OPERATION",
        "EXPENSIVE_LOOP",
        "INEFFICIENT_COLLECTION",
        "UNNECESSARY_OBJECT_CREATION",
        "MISSING_CACHING",
        "DIP_CANDIDATE",
        "OCP_CANDIDATE",
        "HEAVY_DATABASE_CALL",
    }
)
_CLASS_TYPES = frozenset(
    {
        "LARGE_CLASS",
        "SRP_CANDIDATE",
        "LSP_CANDIDATE",
        "ISP_CANDIDATE",
        "SINGLETON",
        "FACTORY",
        "REPOSITORY",
        "OBSERVER",
        "BUILDER",
        "STRATEGY",
        "ADAPTER",
        "DECORATOR",
        "FACADE",
    }
)

_ESTIMATED_IMPACT_BY_TYPE: dict[str, str] = {
    "HIGH_COMPLEXITY": "Increases the risk of bugs whenever this logic changes and makes thorough testing harder to achieve.",
    "LONG_METHOD": "Harder to understand, test, and reuse in isolation; slows down onboarding for new contributors.",
    "LARGE_CLASS": "Changes to this class carry a wider blast radius than a smaller, focused class would.",
    "DEEP_NESTING": "Easy to introduce logic errors when modifying; hard to reason about all the paths through this code.",
    "DUPLICATE_LOGIC": "A bug fix or behavior change applied to one copy is easy to forget applying to the others.",
    "UNUSED_IMPORT": "Minor - mostly noise, but accumulates and slightly obscures a file's real dependencies.",
    "UNUSED_VARIABLE": "Minor - dead code that adds noise and can mislead a reader into thinking the value matters.",
    "LARGE_FILE": "Harder to navigate and more likely to mix unrelated concerns over time.",
    "HARDCODED_SECRET": "If this code is public or the repo is ever exposed, the credential is compromised and must be rotated immediately.",
    "SQL_INJECTION_RISK": "Could allow an attacker to read, modify, or delete data outside the application's intended access.",
    "WEAK_AUTHENTICATION": "Network traffic could be intercepted or tampered with by a man-in-the-middle attacker.",
    "SENSITIVE_DATA_EXPOSURE": "Sensitive values could end up in log aggregation systems, backups, or third-party log processors.",
    "MISSING_AUTHORIZATION": "An endpoint may be reachable by users who shouldn't have access, depending on deployment context.",
    "WEAK_JWT": "Authentication tokens could be forged or brute-forced, potentially allowing full account takeover.",
    "XSS_RISK": "An attacker could inject a script that runs in another user's browser session.",
    "UNSAFE_CONFIGURATION": "Could expose internal details to end users or allow unintended cross-origin access with credentials.",
    "WEAK_PASSWORD_HANDLING": "Password data may be recoverable if the database is ever compromised.",
    "CSRF_RISK": "A malicious site could trigger authenticated actions on a user's behalf without their consent.",
    "N_PLUS_ONE_QUERY": "Response times will degrade as the underlying collection grows, potentially causing timeouts under load.",
    "BLOCKING_OPERATION": "Reduces throughput under concurrent load since other requests queue behind this call.",
    "EXPENSIVE_LOOP": "Execution time grows faster than linearly with input size - can become a real bottleneck at scale.",
    "LARGE_OBJECT": "Increases memory footprint and parse/load time wherever this module is imported.",
    "INEFFICIENT_COLLECTION": "Scales worse than necessary as the collection being searched grows.",
    "UNNECESSARY_OBJECT_CREATION": "Adds avoidable allocation/GC pressure, most noticeable in hot loops.",
    "MISSING_CACHING": "Repeated calls do repeated expensive work that a cache could have avoided.",
    "HEAVY_DATABASE_CALL": "Risks loading unbounded data into memory as the underlying table grows.",
    "CIRCULAR_DEPENDENCY": "Makes it impossible to reason about or test either file independently of the other.",
    "HIGH_MODULE_COUPLING": "Changes to this file are more likely to have ripple effects across the codebase.",
    "DEEP_DEPENDENCY_CHAIN": "Hard to predict what a change might affect without tracing the whole chain.",
    "LAYER_VIOLATION": "Undermines the intended separation of concerns, making the codebase harder to reason about in layers.",
    "UNSAFE_DEPENDENCY": "A known, publicly documented vulnerability is present in a dependency this code relies on.",
    "SRP_CANDIDATE": "Multiple unrelated reasons to change this class increase the chance an unrelated change breaks something.",
    "DIP_CANDIDATE": "Harder to test in isolation (can't substitute a mock/fake) and harder to swap the implementation later.",
    "OCP_CANDIDATE": "Every new case requires modifying and re-testing this function instead of adding isolated new code.",
    "LSP_CANDIDATE": "Code that expects the parent type may break unexpectedly when given this subtype.",
    "ISP_CANDIDATE": "Implementers are forced to depend on (and stub out) methods they don't actually use.",
}
_DEFAULT_ESTIMATED_IMPACT = "May increase maintenance cost and the risk of defects if left unaddressed."


def compute_priority(finding: RawFinding) -> str:
    rank = _SEVERITY_RANK.get(finding.severity, 0)
    if finding.category == "SECURITY":
        rank += 1
    if finding.confidence < 50:
        rank -= 1
    rank = max(0, min(4, rank))
    return _RANK_TO_SEVERITY[rank]


def compute_evidence(finding: RawFinding) -> str:
    if finding.evidence:
        return finding.evidence

    metadata = finding.metadata
    if "complexity" in metadata:
        return f"Cyclomatic complexity: {metadata['complexity']}"
    if "cycle" in metadata:
        return " -> ".join(metadata["cycle"])
    if "depth" in metadata:
        return f"Nesting depth: {metadata['depth']}"
    if "loop_depth" in metadata:
        return f"{metadata['loop_depth']} nested loops"
    if "method_count" in metadata:
        return f"{metadata['method_count']} methods, {metadata.get('lines', '?')} lines"
    if "element_count" in metadata:
        return f"{metadata['element_count']} inline elements"
    if "vuln_ids" in metadata:
        return ", ".join(metadata["vuln_ids"])
    return finding.title


def compute_related_files(finding: RawFinding) -> list[str]:
    metadata = finding.metadata
    if "cycle" in metadata:
        return list(dict.fromkeys(metadata["cycle"]))
    if "locations" in metadata:
        return list(dict.fromkeys(loc["file_path"] for loc in metadata["locations"]))
    if "target_path" in metadata and finding.file_path:
        return [finding.file_path, metadata["target_path"]]
    return [finding.file_path] if finding.file_path else []


def compute_related_symbols(finding: RawFinding) -> tuple[list[str], list[str]]:
    """Returns (related_classes, related_functions)."""
    classes: list[str] = []
    functions: list[str] = []

    if finding.symbol_name:
        if finding.type in _CLASS_TYPES:
            classes.append(finding.symbol_name)
        elif finding.type in _FUNCTION_TYPES:
            functions.append(finding.symbol_name)

    metadata = finding.metadata
    if "instantiated_types" in metadata:
        classes.extend(metadata["instantiated_types"])
    if "method_names" in metadata:
        functions.extend(metadata["method_names"])
    if "trivial_methods" in metadata:
        functions.extend(metadata["trivial_methods"])

    return list(dict.fromkeys(classes)), list(dict.fromkeys(functions))


def compute_estimated_impact(finding: RawFinding) -> str:
    return _ESTIMATED_IMPACT_BY_TYPE.get(finding.type, _DEFAULT_ESTIMATED_IMPACT)
