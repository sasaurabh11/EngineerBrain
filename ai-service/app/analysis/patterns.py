import re

from app.analysis.analyzer import AnalysisContext, RawFinding

_INSTANCE_METHOD_RE = re.compile(r"^(get[_-]?instance|instance)$", re.IGNORECASE)
_FACTORY_METHOD_RE = re.compile(r"^(create|make|build)[A-Z_]", re.IGNORECASE)
_FACTORY_CLASS_RE = re.compile(r"factory$", re.IGNORECASE)
_REPOSITORY_CLASS_RE = re.compile(r"(repository|repo)$", re.IGNORECASE)
_CRUD_METHOD_RE = re.compile(r"^(find|get|create|update|delete|save|list)", re.IGNORECASE)
_SUBSCRIBE_METHOD_RE = re.compile(r"^(subscribe|on|add[_-]?listener|add[_-]?event[_-]?listener)", re.IGNORECASE)
_NOTIFY_METHOD_RE = re.compile(r"^(emit|notify|dispatch|publish)", re.IGNORECASE)
_BUILDER_CLASS_RE = re.compile(r"builder$", re.IGNORECASE)


def _pattern_finding(file_path: str, symbol, pattern: str, explanation: str, metadata: dict) -> RawFinding:
    return RawFinding(
        category="PATTERN",
        type=pattern,
        severity="INFO",
        title=f"`{symbol.name}` looks like a {pattern.replace('_', ' ').title()} pattern",
        explanation=explanation,
        confidence=45,
        file_path=file_path,
        start_line=symbol.start_line,
        end_line=symbol.end_line,
        symbol_name=symbol.name,
        metadata=metadata,
    )


class DesignPatternDetector:
    """Naming/structure-based candidates only - real pattern usage requires
    semantic judgment a heuristic can't make reliably, so these are deliberately
    scored low-confidence and meant for Stage 2 (AI) confirmation, not as a
    final verdict. Strategy/Adapter/Facade/Decorator are intentionally not
    attempted here: structurally they all look like "a class wrapping another
    class," indistinguishable from ordinary composition without deeper semantic
    reasoning - a heuristic would misfire constantly."""

    name = "design_patterns"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
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
        return findings
