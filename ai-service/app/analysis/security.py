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

_JWT_NONE_ALG_RE = re.compile(r"algorithm[s]?\s*[:=]\s*\[?[\"']none[\"']", re.IGNORECASE)
_JWT_CALL_RE = re.compile(r"\bjwt\.(sign|verify)\s*\(", re.IGNORECASE)
_JWT_SHORT_SECRET_RE = re.compile(r"\bjwt\.(sign|verify)\s*\([^)]*[\"']([^\"']{1,7})[\"']", re.IGNORECASE)

_XSS_PATTERNS = [
    re.compile(r"dangerouslySetInnerHTML"),
    re.compile(r"\.innerHTML\s*="),
    re.compile(r"document\.write\s*\("),
    re.compile(r"\|\s*safe\b"),  # Jinja2 |safe filter disables autoescaping
]

_CORS_WILDCARD_RE = re.compile(r"origin\s*:\s*[\"']\*[\"']|Access-Control-Allow-Origin.*\*", re.IGNORECASE)
_CORS_CREDENTIALS_RE = re.compile(r"credentials\s*:\s*true", re.IGNORECASE)
_DEBUG_TRUE_PATTERNS = [
    re.compile(r"^\s*DEBUG\s*=\s*True\s*$"),
    re.compile(r"debug\s*:\s*true", re.IGNORECASE),
    re.compile(r"app\.debug\s*=\s*True", re.IGNORECASE),
]

_PASSWORD_VAR_RE = re.compile(r"(?i)\bpassword\b")
_PLAIN_EQUALITY_RE = re.compile(r"==|===")
_HASH_LIB_RE = re.compile(r"(?i)\b(bcrypt|argon2|scrypt|pbkdf2|hashlib|password_hash|werkzeug\.security)\b")

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


class WeakJwtAnalyzer:
    name = "weak_jwt"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            if not _JWT_CALL_RE.search(text):
                continue

            for line_no, line in enumerate(text.splitlines(), start=1):
                if _JWT_NONE_ALG_RE.search(line):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="WEAK_JWT",
                            severity="CRITICAL",
                            title=f"JWT algorithm set to 'none' in {file.path}",
                            explanation=(
                                f"Line {line_no} allows the 'none' JWT algorithm, which accepts completely unsigned "
                                "tokens - anyone can forge a token with arbitrary claims."
                            ),
                            evidence="algorithm: 'none' permitted",
                            suggested_fix="Explicitly allow-list a strong signing algorithm (e.g. RS256/HS256) and never accept 'none'.",
                            confidence=90,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )

                secret_match = _JWT_SHORT_SECRET_RE.search(line)
                if secret_match:
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="WEAK_JWT",
                            severity="HIGH",
                            title=f"Very short JWT signing secret in {file.path}",
                            explanation=(
                                f"Line {line_no} signs/verifies a JWT with a secret only {len(secret_match.group(2))} "
                                "characters long, which is practically brute-forceable."
                            ),
                            evidence=f"Secret length: {len(secret_match.group(2))} characters",
                            suggested_fix="Use a long, random secret (32+ bytes) loaded from a secrets manager or environment variable, not a short literal.",
                            confidence=70,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class XssAnalyzer:
    name = "xss_risk"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            for line_no, line in enumerate(text.splitlines(), start=1):
                for pattern in _XSS_PATTERNS:
                    if pattern.search(line):
                        findings.append(
                            RawFinding(
                                category="SECURITY",
                                type="XSS_RISK",
                                severity="HIGH",
                                title=f"Possible XSS risk in {file.path}",
                                explanation=(
                                    f"Line {line_no} renders content in a way that bypasses HTML escaping "
                                    f"({pattern.pattern}). If the content includes unsanitized user input, this "
                                    "allows script injection into the page."
                                ),
                                evidence=line.strip()[:200],
                                suggested_fix="Sanitize the content (e.g. DOMPurify) before rendering as raw HTML, or avoid raw HTML rendering entirely.",
                                confidence=65,
                                file_path=file.path,
                                start_line=line_no,
                                end_line=line_no,
                            )
                        )
                        break
        return findings


class UnsafeConfigurationAnalyzer:
    name = "unsafe_configuration"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")

            if _CORS_WILDCARD_RE.search(text) and _CORS_CREDENTIALS_RE.search(text):
                findings.append(
                    RawFinding(
                        category="SECURITY",
                        type="UNSAFE_CONFIGURATION",
                        severity="HIGH",
                        title=f"CORS allows any origin together with credentials in {file.path}",
                        explanation=(
                            "This file configures CORS with a wildcard origin ('*') alongside credentials: true. "
                            "Browsers block this combination for good reason - if enabled another way (e.g. by "
                            "reflecting the request origin), it lets any website make authenticated requests on a "
                            "user's behalf."
                        ),
                        evidence="Wildcard origin + credentials:true both present",
                        suggested_fix="Allow-list specific trusted origins instead of '*' when credentials are enabled.",
                        confidence=65,
                        file_path=file.path,
                    )
                )

            for line_no, line in enumerate(text.splitlines(), start=1):
                if any(pattern.search(line) for pattern in _DEBUG_TRUE_PATTERNS):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="UNSAFE_CONFIGURATION",
                            severity="MEDIUM",
                            title=f"Debug mode hardcoded on in {file.path}",
                            explanation=(
                                f"Line {line_no} hardcodes debug mode on. Debug mode often exposes stack traces, "
                                "internal paths, or a debugger console to end users if this ships to production."
                            ),
                            evidence=line.strip()[:200],
                            suggested_fix="Gate debug mode behind an environment variable that defaults to off, not a hardcoded True/true.",
                            confidence=55,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class WeakPasswordHandlingAnalyzer:
    name = "weak_password_handling"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        findings: list[RawFinding] = []
        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            has_hash_lib = bool(_HASH_LIB_RE.search(text))
            if has_hash_lib:
                continue  # a recognized hashing library is used somewhere in the file - don't flag

            for line_no, line in enumerate(text.splitlines(), start=1):
                if _PASSWORD_VAR_RE.search(line) and _PLAIN_EQUALITY_RE.search(line):
                    findings.append(
                        RawFinding(
                            category="SECURITY",
                            type="WEAK_PASSWORD_HANDLING",
                            severity="HIGH",
                            title=f"Password compared with plain equality in {file.path}",
                            explanation=(
                                f"Line {line_no} compares a password using plain equality, with no hashing library "
                                "referenced anywhere in this file. This suggests passwords may be stored/compared in "
                                "plaintext rather than hashed, and even if hashed elsewhere, plain `==` comparison is "
                                "vulnerable to timing attacks."
                            ),
                            evidence=line.strip()[:200],
                            suggested_fix="Hash passwords with bcrypt/argon2 at rest, and compare using the library's constant-time verify function, never `==`.",
                            confidence=45,
                            file_path=file.path,
                            start_line=line_no,
                            end_line=line_no,
                        )
                    )
        return findings


class CsrfAnalyzer:
    """A repository-wide check, not per-file: session-based auth without any
    csrf-protection reference anywhere in the codebase is a real gap, but it
    can only be judged by looking at the whole repository at once."""

    name = "csrf_risk"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        session_file: str | None = None
        has_csrf_mention = False

        for file in context.files:
            text = file.source.decode("utf-8", errors="replace")
            if session_file is None and re.search(r"(?i)express-session|cookie-session|req\.session\b", text):
                session_file = file.path
            if re.search(r"(?i)csrf", text):
                has_csrf_mention = True

        if session_file is None or has_csrf_mention:
            return []

        return [
            RawFinding(
                category="SECURITY",
                type="CSRF_RISK",
                severity="MEDIUM",
                title="Session-based authentication with no CSRF protection found",
                explanation=(
                    f"{session_file} uses session-based authentication, but no CSRF-related code (middleware, "
                    "tokens, or checks) was found anywhere in the repository. Session-based auth is vulnerable to "
                    "cross-site request forgery unless explicitly protected."
                ),
                evidence="Session-based auth present; no 'csrf' reference found in the codebase",
                suggested_fix="Add CSRF protection (e.g. a double-submit cookie or synchronizer token pattern) to state-changing routes.",
                confidence=45,
                file_path=session_file,
            )
        ]
