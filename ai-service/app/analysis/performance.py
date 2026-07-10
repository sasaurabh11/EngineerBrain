from app.analysis import ast_utils
from app.analysis.analyzer import AnalysisContext, RawFinding

# Deliberately narrow, high-signal DB-call names - broader names like "get"/"find"/
# "all"/"filter" were excluded because they false-positive constantly on ordinary
# collection/object methods that have nothing to do with a database.
_QUERY_CALLEE_NAMES = frozenset(
    {"findOne", "findMany", "findById", "findUnique", "findFirst", "query", "execute", "fetchone", "fetchall", "get_or_create"}
)
_BLOCKING_SUFFIX = "Sync"
_BLOCKING_PY_NAMES = frozenset({"sleep"})
MAX_LOOP_NESTING = 2


def _function_name(node, source: bytes) -> str:
    name_node = node.child_by_field_name("name")
    return ast_utils.node_text(name_node, source) if name_node is not None else "<anonymous>"


class NPlusOneAnalyzer:
    name = "n_plus_one"

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
                for loop_node in ast_utils.nodes_within(func_node, profile.loop_node_types):
                    calls = ast_utils.find_calls(loop_node, profile, file.source)
                    matches = [callee for callee, _n in calls if callee in _QUERY_CALLEE_NAMES]
                    if not matches:
                        continue
                    findings.append(
                        RawFinding(
                            category="PERFORMANCE",
                            type="N_PLUS_ONE_QUERY",
                            severity="HIGH",
                            title=f"Possible N+1 query in `{name}`",
                            explanation=(
                                f"`{name}` calls `{matches[0]}(...)` inside a loop (line {loop_node.start_point[0] + 1}). "
                                "If that call hits a database, this issues one query per iteration instead of one "
                                "batched query, which scales badly as the collection grows."
                            ),
                            suggested_fix="Batch the lookup outside the loop (e.g. a single query with an IN clause, or an eager-load/include) instead of querying per item.",
                            confidence=60,
                            file_path=file.path,
                            start_line=loop_node.start_point[0] + 1,
                            end_line=loop_node.end_point[0] + 1,
                            symbol_name=name,
                            metadata={"callee": matches[0]},
                        )
                    )
        return findings


class BlockingOperationAnalyzer:
    name = "blocking_operations"

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
                if not ast_utils.is_async_function(func_node, file.source):
                    continue
                name = _function_name(func_node, file.source)
                for callee, call_node in ast_utils.find_calls(func_node, profile, file.source):
                    is_blocking = callee.endswith(_BLOCKING_SUFFIX) or callee in _BLOCKING_PY_NAMES
                    if not is_blocking:
                        continue
                    findings.append(
                        RawFinding(
                            category="PERFORMANCE",
                            type="BLOCKING_OPERATION",
                            severity="MEDIUM",
                            title=f"Blocking call `{callee}` inside async function `{name}`",
                            explanation=(
                                f"`{name}` is async but calls the blocking `{callee}(...)` (line "
                                f"{call_node.start_point[0] + 1}), which stalls the event loop / thread for its "
                                "entire duration instead of yielding control."
                            ),
                            suggested_fix="Use the async/non-blocking equivalent (e.g. an async file API, or run the blocking call in a worker thread/executor).",
                            confidence=75,
                            file_path=file.path,
                            start_line=call_node.start_point[0] + 1,
                            end_line=call_node.end_point[0] + 1,
                            symbol_name=name,
                            metadata={"callee": callee},
                        )
                    )
        return findings


class ExpensiveLoopAnalyzer:
    name = "expensive_loops"

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
                depth = ast_utils.max_loop_nesting_depth(func_node, profile)
                if depth <= MAX_LOOP_NESTING:
                    continue
                name = _function_name(func_node, file.source)
                findings.append(
                    RawFinding(
                        category="PERFORMANCE",
                        type="EXPENSIVE_LOOP",
                        severity="MEDIUM",
                        title=f"`{name}` has {depth} nested loops",
                        explanation=(
                            f"`{name}` nests loops {depth} levels deep, which typically means O(n^{depth}) or worse "
                            "time complexity - this can become very slow as input size grows."
                        ),
                        suggested_fix="Look for a way to avoid the nested iteration - e.g. an index/lookup map, a different algorithm, or batching.",
                        confidence=65,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"loop_depth": depth},
                    )
                )
        return findings
