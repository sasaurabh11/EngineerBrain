import re

from app.analysis.analyzer import AnalysisContext, RawFinding
from app.indexing.endpoint_detector import detect_decorator_endpoints
from app.indexing.pipeline import _flatten_symbols

_SECRET_PATTERNS = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"), "private key"),
    (
        re.compile(r"(?i)\b(api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*[\"']([^\"'\s]{8,})[\"']"),
        "hardcoded credential",
    ),
    (re.compile(r"(?i)Bearer\s+[A-Za-z0-9\-_.]{20,}"), "hardcoded bearer token"),
]

_SQL_KEYWORDS = re.compile(r"\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b", re.IGNORECASE)
_SQL_CONCAT_PATTERNS = [
    re.compile(r"(SELECT|INSERT INTO|UPDATE|DELETE FROM)[^\"'`]*[\"'`]\s*\+", re.IGNORECASE),  # "..." + var
    re.compile(r"f[\"'].*\{[^}]+\}.*(SELECT|INSERT INTO|UPDATE|DELETE FROM)", re.IGNORECASE),  # python f-string
    re.compile(r"`[^`]*\$\{[^}]+\}[^`]*(SELECT|INSERT INTO|UPDATE|DELETE FROM)", re.IGNORECASE),  # JS template literal
    re.compile(r"(SELECT|INSERT INTO|UPDATE|DELETE FROM)[^`\"']*`[^`]*\$\{", re.IGNORECASE),
]

_WEAK_TLS_PATTERNS = [
    re.compile(r"verify\s*=\s*False"),
    re.compile(r"rejectUnauthorized\s*:\s*false"),
    re.compile(r"NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0"),
    re.compile(r"(?i)ssl\._create_unverified_context"),
]

_SENSITIVE_LOG_VARS = re.compile(r"(?i)\b(password|secret|token|api[_-]?key|ssn|credit[_-]?card)\b")
_LOG_CALL = re.compile(r"(?i)\b(console\.(log|info|debug|warn|error)|logger\.\w+|print|logging\.\w+)\s*\(")

_AUTH_GUARD_PATTERNS = re.compile(r"(?i)(UseGuards|Secured|PreAuthorize|RolesAllowed|RequireAuth|Authenticated|IsAuthenticated|LoginRequired|requireAuth|authMiddleware)")


class HardcodedSecretAnalyzer:
    name = "hardcoded_secrets"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            for line_no, line in enumerate(text.splitlines(), start=1):
                for pattern, label in _SECRET_PATTERNS:
                    if pattern.search(line):
                        findings.append(
                            RawFinding(
                                category="SECURITY",
                                type="HARDCODED_SECRET",
                                severity="CRITICAL",
                                title=f"Possible {label} hardcoded in {file.path}",
                                explanation=(
                                    f"Line {line_no} in {file.path} matches the pattern for a {label}. "
                                    "Committing credentials to source control exposes them to anyone with repo access "
                                    "and to the full git history even if removed later."
                                ),
                                suggested_fix="Move this value to an environment variable or a secrets manager, and rotate the credential since it may already be compromised.",
                                confidence=85,
                                file_path=file.path,
                                start_line=line_no,
                                end_line=line_no,
                                metadata={"pattern": label},
                            )
                        )
                        break
        return findings


class SqlInjectionAnalyzer:
    name = "sql_injection"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            for line_no, line in enumerate(text.splitlines(), start=1):
                if not _SQL_KEYWORDS.search(line):
                    continue
                if any(pattern.search(line) for pattern in _SQL_CONCAT_PATTERNS):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="SQL_INJECTION_RISK",
                            severity="HIGH",
                            title=f"Possible SQL injection risk in {file.path}",
                            explanation=(
                                f"Line {line_no} builds a SQL statement via string concatenation or interpolation "
                                "rather than parameter binding, which lets attacker-controlled input alter the query."
                            ),
                            suggested_fix="Use parameterized queries / prepared statements (or your ORM's query builder) instead of concatenating values into SQL text.",
                            confidence=70,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class WeakTlsAnalyzer:
    name = "weak_tls"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            for line_no, line in enumerate(text.splitlines(), start=1):
                if any(pattern.search(line) for pattern in _WEAK_TLS_PATTERNS):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="WEAK_AUTHENTICATION",
                            severity="HIGH",
                            title=f"TLS/certificate verification disabled in {file.path}",
                            explanation=(
                                f"Line {line_no} in {file.path} disables TLS certificate verification, making "
                                "network requests vulnerable to man-in-the-middle attacks."
                            ),
                            suggested_fix="Never disable certificate verification in production code; if this is for local development, gate it behind an environment check.",
                            confidence=90,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class SensitiveDataLoggingAnalyzer:
    name = "sensitive_data_logging"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            for line_no, line in enumerate(text.splitlines(), start=1):
                if _LOG_CALL.search(line) and _SENSITIVE_LOG_VARS.search(line):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="SENSITIVE_DATA_EXPOSURE",
                            severity="MEDIUM",
                            title=f"Possible sensitive data in a log statement in {file.path}",
                            explanation=(
                                f"Line {line_no} logs a value alongside a variable name suggesting sensitive data "
                                "(password/secret/token/etc). Logs are often retained, shipped to third parties, or "
                                "widely accessible, so sensitive values shouldn't pass through them."
                            ),
                            suggested_fix="Redact or omit sensitive fields before logging (e.g. log a masked value or the field name only).",
                            confidence=60,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class MissingAuthorizationAnalyzer:
    """Decorator-based frameworks only (NestJS/Spring) - Express routes have no
    per-route decorator to inspect, so middleware-chain analysis would be needed
    there and is out of scope for this heuristic."""

    name = "missing_authorization"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            symbol_payloads, _ = _flatten_symbols(file.parsed.symbols, file.path)
            endpoints = detect_decorator_endpoints(symbol_payloads, file.path)
            if not endpoints:
                continue

            by_id = {s.id: s for s in symbol_payloads}
            for endpoint in endpoints:
                if endpoint.framework not in ("NestJS", "Spring Boot") or endpoint.symbol_id is None:
                    continue
                symbol = by_id.get(endpoint.symbol_id)
                if symbol is None:
                    continue
                decorators = symbol.metadata.get("decorators", [])
                parent = by_id.get(symbol.parent_id) if symbol.parent_id else None
                parent_decorators = parent.metadata.get("decorators", []) if parent else []
                has_guard = any(_AUTH_GUARD_PATTERNS.search(d) for d in decorators + parent_decorators)
                if has_guard:
                    continue
                findings.append(
                    RawFinding(
                        category="SECURITY",
                        type="MISSING_AUTHORIZATION",
                        severity="MEDIUM",
                        title=f"{endpoint.method} {endpoint.path} has no visible auth guard",
                        explanation=(
                            f"The handler for `{endpoint.method} {endpoint.path}` in {file.path} has no recognizable "
                            "authorization decorator/guard on it or its class. It may be intentionally public, but "
                            "that should be explicit."
                        ),
                        suggested_fix="Add an explicit auth guard/decorator if this endpoint should require authentication, or document that it's intentionally public.",
                        confidence=55,
                        file_path=file.path,
                        symbol_name=symbol.name,
                        metadata={"method": endpoint.method, "path": endpoint.path},
                    )
                )
        return findings
