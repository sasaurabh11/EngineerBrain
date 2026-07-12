import re
from collections import defaultdict

from app.analysis.analyzer import AnalysisContext, RawFinding

_INSTANCE_METHOD_RE = re.compile(r"^(get[_-]?instance|instance)$", re.IGNORECASE)
_FACTORY_METHOD_RE = re.compile(r"^(create|make|build)[A-Z_]", re.IGNORECASE)
_FACTORY_CLASS_RE = re.compile(r"factory$", re.IGNORECASE)
_REPOSITORY_CLASS_RE = re.compile(r"(repository|repo)$", re.IGNORECASE)
_CRUD_METHOD_RE = re.compile(r"^(find|get|create|update|delete|save|list)", re.IGNORECASE)
_SUBSCRIBE_METHOD_RE = re.compile(r"^(subscribe|on|add[_-]?listener|add[_-]?event[_-]?listener)", re.IGNORECASE)
_NOTIFY_METHOD_RE = re.compile(r"^(emit|notify|dispatch|publish)", re.IGNORECASE)
_BUILDER_CLASS_RE = re.compile(r"builder$", re.IGNORECASE)
_ADAPTER_CLASS_RE = re.compile(r"adapter$", re.IGNORECASE)
_DECORATOR_CLASS_RE = re.compile(r"decorator$", re.IGNORECASE)
_FACADE_CLASS_RE = re.compile(r"facade$", re.IGNORECASE)
_GENERIC_BASE_NAMES = frozenset({"object", "exception", "error", "component"})


def _pattern_finding(file_path: str, symbol, pattern: str, explanation: str, metadata: dict, confidence: int = 45) -> RawFinding:
    return RawFinding(
        category="PATTERN",
        type=pattern,
        severity="INFO",
        title=f"`{symbol.name}` looks like a {pattern.replace('_', ' ').title()} pattern",
        explanation=explanation,
        confidence=confidence,
        file_path=file_path,
        start_line=symbol.start_line,
        end_line=symbol.end_line,
        symbol_name=symbol.name,
        metadata=metadata,
    )


def _detect_strategy_families(context: AnalysisContext) -> list[RawFinding]:
    """A real structural signal, not naming: several classes implementing or
    extending the same interface/base and sharing a method name is exactly the
    Strategy pattern's shape (interchangeable implementations behind one
    contract) - stronger evidence than the naming-only checks below."""
    groups: dict[str, list[tuple[str, object]]] = defaultdict(list)
    for file in context.files:
        for symbol in file.parsed.symbols:
            if symbol.kind.value != "CLASS":
                continue
            for key in ("interfaces", "superclasses"):
                value = symbol.metadata.get(key)
                if not value:
                    continue
                for base_name in (n.strip() for n in value.split(",") if n.strip()):
                    if base_name.lower() not in _GENERIC_BASE_NAMES:
                        groups[base_name].append((file.path, symbol))

    findings: list[RawFinding] = []
    for base_name, members in groups.items():
        if len(members) < 2:
            continue
        method_sets = [{c.name for c in symbol.children if c.kind.value == "METHOD"} for _path, symbol in members]
        shared_methods = set.intersection(*method_sets) if method_sets else set()
        if not shared_methods:
            continue
        for path, symbol in members:
            findings.append(
                _pattern_finding(
                    path,
                    symbol,
                    "STRATEGY",
                    (
                        f"`{symbol.name}` is one of {len(members)} interchangeable implementations of `{base_name}` "
                        f"sharing method(s) {', '.join(sorted(shared_methods))} - the Strategy pattern's shape."
                    ),
                    {"shared_base": base_name, "sibling_count": len(members), "shared_methods": sorted(shared_methods)},
                    confidence=55,
                )
            )
    return findings


class DesignPatternDetector:
    """Candidates only, not confirmed pattern usage - Stage 2 (AI) judges each
    one. Singleton/Factory/Repository/Observer/Builder/Strategy have a real
    structural signal (method shapes, or - for Strategy - a shared method
    across sibling implementations of the same base). Adapter/Decorator/Facade
    only have naming to go on here (no reliable structural signature without
    deeper semantic analysis of what's being wrapped/delegated), so they're
    scored lower confidence to reflect that honestly."""

    name = "design_patterns"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = list(_detect_strategy_families(context))
        for file in context.files:
            for symbol in file.parsed.symbols:
                if symbol.kind.value != "CLASS":
                    continue
                method_names = [c.name for c in symbol.children if c.kind.value == "METHOD"]

                if any(_INSTANCE_METHOD_RE.match(name) for name in method_names):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "SINGLETON",
                            f"`{symbol.name}` has an instance-accessor method, the classic Singleton signature.",
                            {"method_names": method_names},
                        )
                    )

                if _FACTORY_CLASS_RE.search(symbol.name) or any(_FACTORY_METHOD_RE.match(name) for name in method_names):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "FACTORY",
                            f"`{symbol.name}` has factory-style naming (a `create*`/`make*`/`build*` method, or a `*Factory` class name).",
                            {"method_names": method_names},
                        )
                    )

                if _REPOSITORY_CLASS_RE.search(symbol.name) and sum(1 for n in method_names if _CRUD_METHOD_RE.match(n)) >= 2:
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "REPOSITORY",
                            f"`{symbol.name}` is named like a repository and exposes CRUD-style methods.",
                            {"method_names": method_names},
                        )
                    )

                has_subscribe = any(_SUBSCRIBE_METHOD_RE.match(n) for n in method_names)
                has_notify = any(_NOTIFY_METHOD_RE.match(n) for n in method_names)
                if has_subscribe and has_notify:
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "OBSERVER",
                            f"`{symbol.name}` has both subscribe-style and notify-style methods, the Observer shape.",
                            {"method_names": method_names},
                        )
                    )

                if _BUILDER_CLASS_RE.search(symbol.name) and any(n.lower() == "build" for n in method_names):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "BUILDER",
                            f"`{symbol.name}` is named like a builder and has a `build()` method.",
                            {"method_names": method_names},
                        )
                    )

                if _ADAPTER_CLASS_RE.search(symbol.name):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "ADAPTER",
                            f"`{symbol.name}` is named like an adapter. Naming alone isn't a strong signal - confirm it actually wraps an incompatible interface behind a compatible one.",
                            {"method_names": method_names},
                            confidence=30,
                        )
                    )

                if _DECORATOR_CLASS_RE.search(symbol.name):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "DECORATOR",
                            f"`{symbol.name}` is named like a decorator. Naming alone isn't a strong signal - confirm it actually wraps another instance of the same interface to add behavior.",
                            {"method_names": method_names},
                            confidence=30,
                        )
                    )

                if _FACADE_CLASS_RE.search(symbol.name):
                    findings.append(
                        _pattern_finding(
                            file.path,
                            symbol,
                            "FACADE",
                            f"`{symbol.name}` is named like a facade. Naming alone isn't a strong signal - confirm it actually simplifies a more complex subsystem behind this interface.",
                            {"method_names": method_names},
                            confidence=30,
                        )
                    )
        return findings
