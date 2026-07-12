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
LARGE_OBJECT_ELEMENT_THRESHOLD = 30
_MEMBERSHIP_CALLEE_NAMES = frozenset({"includes", "indexOf", "contains"})
_GETTER_NAME_RE_PREFIXES = ("get", "fetch", "load", "find")
_MEMOIZATION_RE = frozenset({"lru_cache", "cache", "memoize", "cached_property"})


def _function_name(node, source: bytes) -> str:
    name_node = node.child_by_field_name("name")
    return ast_utils.node_text(name_node, source) if name_node is not None else "<anonymous>"


def _function_param_count(func_node) -> int:
    params = func_node.child_by_field_name("parameters")
    if params is None:
        return 0
    return sum(1 for c in params.children if c.is_named)


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


class LargeObjectAnalyzer:
    name = "large_objects"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for literal in ast_utils.find_literals(root):
                count = ast_utils.literal_element_count(literal)
                if count < LARGE_OBJECT_ELEMENT_THRESHOLD:
                    continue
                findings.append(
                    RawFinding(
                        category="PERFORMANCE",
                        type="LARGE_OBJECT",
                        severity="LOW",
                        title=f"Large inline literal ({count} elements) in {file.path}",
                        explanation=(
                            f"This literal has {count} elements defined inline. Large inline data structures increase "
                            "memory footprint and parse/load time, and are usually a sign the data belongs in a "
                            "database, config file, or generated at runtime instead of hardcoded."
                        ),
                        evidence=f"{count} inline elements",
                        suggested_fix="Move this data to a database, config file, or a generator function instead of an inline literal.",
                        confidence=50,
                        file_path=file.path,
                        start_line=literal.start_point[0] + 1,
                        end_line=literal.end_point[0] + 1,
                        metadata={"element_count": count},
                    )
                )
        return findings


class InefficientCollectionAnalyzer:
    name = "inefficient_collections"

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
                    for callee, call_node in ast_utils.find_calls(loop_node, profile, file.source):
                        if callee not in _MEMBERSHIP_CALLEE_NAMES:
                            continue
                        findings.append(
                            RawFinding(
                                category="PERFORMANCE",
                                type="INEFFICIENT_COLLECTION",
                                severity="LOW",
                                title=f"O(n) membership check inside a loop in `{name}`",
                                explanation=(
                                    f"`{callee}(...)` (line {call_node.start_point[0] + 1}) scans the whole collection "
                                    "on every call. Doing this inside a loop makes the overall check O(n*m) instead of "
                                    "O(n) if the collection were a Set/Map with O(1) lookup."
                                ),
                                evidence=f"{callee}() called inside a loop",
                                suggested_fix="Convert the collection being searched to a Set/Map built once before the loop, then do O(1) lookups inside it.",
                                confidence=40,
                                file_path=file.path,
                                start_line=call_node.start_point[0] + 1,
                                end_line=call_node.end_point[0] + 1,
                                symbol_name=name,
                                metadata={"callee": callee},
                            )
                        )

                    if file.language == "python":
                        self._check_python_in_operator(loop_node, file, name, findings)
        return findings

    @staticmethod
    def _check_python_in_operator(loop_node, file, function_name: str, findings: list[RawFinding]) -> None:
        def walk(node) -> None:
            if node.type == "comparison_operator":
                operators = [c for c in node.children if c.type == "in"]
                if operators:
                    findings.append(
                        RawFinding(
                            category="PERFORMANCE",
                            type="INEFFICIENT_COLLECTION",
                            severity="LOW",
                            title=f"O(n) membership check inside a loop in `{function_name}`",
                            explanation=(
                                f"An `in` membership check (line {node.start_point[0] + 1}) scans the whole collection "
                                "on every call. Doing this inside a loop makes the overall check O(n*m) instead of "
                                "O(n) if the collection were a set/dict with O(1) lookup."
                            ),
                            evidence="`in` operator used inside a loop",
                            suggested_fix="Convert the collection being searched to a set/dict built once before the loop, then do O(1) lookups inside it.",
                            confidence=35,
                            file_path=file.path,
                            start_line=node.start_point[0] + 1,
                            end_line=node.end_point[0] + 1,
                            symbol_name=function_name,
                        )
                    )
            for child in node.children:
                walk(child)

        walk(loop_node)


class UnnecessaryObjectCreationAnalyzer:
    name = "unnecessary_object_creation"

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
                seen_literal_positions: set[int] = set()
                for loop_node in ast_utils.nodes_within(func_node, profile.loop_node_types):
                    for literal in ast_utils.find_literals(loop_node):
                        # A literal inside a nested loop is reachable from both the outer
                        # and inner loop's search - only report it once.
                        if literal.start_byte in seen_literal_positions:
                            continue
                        seen_literal_positions.add(literal.start_byte)
                        # Skip empty/tiny literals - hoisting `{}`/`[]` isn't meaningfully wasteful.
                        if ast_utils.literal_element_count(literal) == 0:
                            continue
                        # Heuristic: if none of the identifiers inside the literal also
                        # appear in the loop's own header (its iteration variable/range),
                        # the literal's value doesn't depend on the loop and could be hoisted.
                        if _shares_identifier(literal, loop_node, file.source):
                            continue
                        findings.append(
                            RawFinding(
                                category="PERFORMANCE",
                                type="UNNECESSARY_OBJECT_CREATION",
                                severity="LOW",
                                title=f"Object/array literal re-created every iteration in `{name}`",
                                explanation=(
                                    f"This literal (line {literal.start_point[0] + 1}) doesn't reference anything "
                                    "from the loop it's inside, so it's rebuilt from scratch on every iteration for no "
                                    "reason - it could be created once outside the loop instead."
                                ),
                                evidence="Literal recreated each iteration, doesn't depend on the loop variable",
                                suggested_fix="Move this literal's creation above the loop and reuse the same value on each iteration.",
                                confidence=35,
                                file_path=file.path,
                                start_line=literal.start_point[0] + 1,
                                end_line=literal.end_point[0] + 1,
                                symbol_name=name,
                            )
                        )
        return findings


def _shares_identifier(literal_node, loop_node, source: bytes) -> bool:
    """True if any identifier used inside `literal_node` also appears as one of
    the loop's own control variables (its header, excluding the loop body)."""
    literal_idents = {ast_utils.node_text(n, source) for n in _identifiers_within(literal_node)}
    if not literal_idents:
        return False

    body_field = loop_node.child_by_field_name("body")
    # tree-sitter's Python bindings return a fresh wrapper object per access, so
    # `is` identity comparison is unreliable here - compare by node equality instead.
    header_nodes = [c for c in loop_node.children if body_field is None or c != body_field]
    header_idents: set[str] = set()
    for node in header_nodes:
        header_idents |= {ast_utils.node_text(n, source) for n in _identifiers_within(node)}

    return bool(literal_idents & header_idents)


def _identifiers_within(node) -> list:
    found = []
    if node.type in ("identifier", "property_identifier"):
        found.append(node)
    for child in node.children:
        found.extend(_identifiers_within(child))
    return found


class MissingCachingAnalyzer:
    """Narrow, distinct from N+1 (loop-repeated calls) and heavy DB calls (any
    expensive call): a zero/one-parameter getter-style function that performs a
    DB/network call with no memoization anywhere in the file - its result looks
    stable enough to be worth caching."""

    name = "missing_caching"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            text = file.source.decode("utf-8", errors="replace")
            has_memoization = any(marker in text for marker in _MEMOIZATION_RE)
            if has_memoization:
                continue

            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for func_node in ast_utils.find_function_nodes(root, profile):
                name = _function_name(func_node, file.source)
                if not name.lower().startswith(_GETTER_NAME_RE_PREFIXES):
                    continue
                if _function_param_count(func_node) > 1:
                    continue

                calls = ast_utils.find_calls(func_node, profile, file.source)
                heavy_calls = [callee for callee, _n in calls if callee in _QUERY_CALLEE_NAMES]
                if not heavy_calls:
                    continue

                findings.append(
                    RawFinding(
                        category="PERFORMANCE",
                        type="MISSING_CACHING",
                        severity="LOW",
                        title=f"`{name}` may benefit from caching",
                        explanation=(
                            f"`{name}` takes {_function_param_count(func_node)} parameter(s), is named like a getter, "
                            f"and calls `{heavy_calls[0]}(...)` - a data-fetch pattern that's often safe and valuable "
                            "to cache, but no memoization was found anywhere in this file."
                        ),
                        evidence=f"Getter-style function calling {heavy_calls[0]}(), no memoization found in file",
                        suggested_fix="Consider memoizing this function's result (e.g. lru_cache in Python, or an in-memory/Redis cache) if its inputs are stable.",
                        confidence=30,
                        file_path=file.path,
                        start_line=func_node.start_point[0] + 1,
                        end_line=func_node.end_point[0] + 1,
                        symbol_name=name,
                        metadata={"callee": heavy_calls[0]},
                    )
                )
        return findings


class HeavyDatabaseCallAnalyzer:
    """Distinct from N+1: this flags a query call with no arguments at all
    (no filter/limit), suggesting an unbounded/full-table fetch, regardless of
    whether it's inside a loop."""

    name = "heavy_database_calls"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            profile = ast_utils.get_profile(file.language)
            if profile is None:
                continue
            root = ast_utils.parse_raw_tree(file.language, file.source)
            if root is None:
                continue

            for callee, call_node in ast_utils.find_calls(root, profile, file.source):
                if callee not in _QUERY_CALLEE_NAMES:
                    continue
                args_field = call_node.child_by_field_name("arguments")
                arg_count = sum(1 for c in args_field.children if c.is_named) if args_field is not None else 0
                if arg_count > 0:
                    continue

                findings.append(
                    RawFinding(
                        category="PERFORMANCE",
                        type="HEAVY_DATABASE_CALL",
                        severity="MEDIUM",
                        title=f"`{callee}()` called with no filter/limit in {file.path}",
                        explanation=(
                            f"`{callee}()` at line {call_node.start_point[0] + 1} is called with no arguments at all - "
                            "no filter, no limit - which risks fetching an entire table into memory as the data grows."
                        ),
                        evidence=f"{callee}() called with zero arguments",
                        suggested_fix="Add a limit/pagination and only select the fields actually needed, rather than fetching everything unconditionally.",
                        confidence=45,
                        file_path=file.path,
                        start_line=call_node.start_point[0] + 1,
                        end_line=call_node.end_point[0] + 1,
                        metadata={"callee": callee},
                    )
                )
        return findings
