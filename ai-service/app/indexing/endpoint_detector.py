import re

from app.indexing.schemas import ApiEndpointPayload, SymbolPayload

_NESTJS_METHOD = re.compile(r"@(Get|Post|Put|Delete|Patch|All)\(\s*(?:[\"'`]([^\"'`]*)[\"'`])?", re.IGNORECASE)
_NESTJS_CONTROLLER = re.compile(r"@Controller\(\s*(?:[\"'`]([^\"'`]*)[\"'`])?\)", re.IGNORECASE)

_SPRING_MAPPING = re.compile(
    r"@(Get|Post|Put|Delete|Patch)Mapping(?:\(\s*(?:(?:value\s*=\s*)?[\"']([^\"']*)[\"'])?\))?", re.IGNORECASE
)
_SPRING_REQUEST_MAPPING = re.compile(
    r"@RequestMapping(?:\(\s*(?:(?:value\s*=\s*)?[\"']([^\"']*)[\"'])?\))?", re.IGNORECASE
)

_FASTAPI_DECORATOR = re.compile(r"@\w+\.(get|post|put|delete|patch)\(\s*[\"']([^\"']*)[\"']", re.IGNORECASE)
_FLASK_ROUTE = re.compile(r"@\w+\.route\(\s*[\"']([^\"']*)[\"']", re.IGNORECASE)
_FLASK_METHODS_KWARG = re.compile(r"methods\s*=\s*\[([^\]]*)\]", re.IGNORECASE)

_NESTJS_METHOD_NAMES = {"GET", "POST", "PUT", "DELETE", "PATCH", "ALL"}


def _match_method_decorator(text: str) -> tuple[str, str, str] | None:
    """Returns (http_method, path, framework) if `text` is a route decorator/annotation."""
    match = _NESTJS_METHOD.search(text)
    if match:
        method = match.group(1).upper()
        if method in _NESTJS_METHOD_NAMES:
            return ("ANY" if method == "ALL" else method, match.group(2) or "", "NestJS")

    match = _SPRING_MAPPING.search(text)
    if match:
        return (match.group(1).upper(), match.group(2) or "", "Spring Boot")

    match = _SPRING_REQUEST_MAPPING.search(text)
    if match:
        return ("GET", match.group(1) or "", "Spring Boot")

    match = _FLASK_ROUTE.search(text)
    if match:
        method = "GET"
        methods_match = _FLASK_METHODS_KWARG.search(text)
        if methods_match:
            first = methods_match.group(1).split(",")[0].strip().strip("\"'")
            if first:
                method = first.upper()
        return (method, match.group(1), "Flask")

    match = _FASTAPI_DECORATOR.search(text)
    if match:
        return (match.group(1).upper(), match.group(2), "FastAPI")

    return None


def _match_class_prefix(text: str) -> str | None:
    match = _NESTJS_CONTROLLER.search(text)
    if match:
        return match.group(1) or ""

    match = _SPRING_REQUEST_MAPPING.search(text)
    if match:
        return match.group(1) or ""

    return None


def _join_path(prefix: str, path: str) -> str:
    combined = f"{prefix.rstrip('/')}/{path.lstrip('/')}" if prefix else path
    combined = combined.strip("/")
    return f"/{combined}" if combined else "/"


def detect_decorator_endpoints(symbol_payloads: list[SymbolPayload], file_path: str) -> list[ApiEndpointPayload]:
    """Detects routes declared via decorators/annotations (NestJS, Spring Boot,
    FastAPI, Flask) by scanning the already-extracted symbol metadata - no
    additional AST access needed since decorator text is captured on every
    METHOD/FUNCTION symbol at parse time."""
    by_id = {symbol.id: symbol for symbol in symbol_payloads}
    endpoints: list[ApiEndpointPayload] = []

    for symbol in symbol_payloads:
        if symbol.kind not in ("METHOD", "FUNCTION"):
            continue

        for decorator_text in symbol.metadata.get("decorators", []):
            matched = _match_method_decorator(decorator_text)
            if matched is None:
                continue

            method, path, framework = matched

            prefix = ""
            parent = by_id.get(symbol.parent_id) if symbol.parent_id else None
            if parent is not None and parent.kind == "CLASS":
                for class_decorator in parent.metadata.get("decorators", []):
                    class_prefix = _match_class_prefix(class_decorator)
                    if class_prefix is not None:
                        prefix = class_prefix
                        break

            endpoints.append(
                ApiEndpointPayload(
                    symbol_id=symbol.id,
                    file_path=file_path,
                    method=method,
                    path=_join_path(prefix, path),
                    framework=framework,
                )
            )
            break

    return endpoints
