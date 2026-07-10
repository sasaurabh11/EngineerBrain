import posixpath

_JS_EXTENSIONS = ("", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
_JS_INDEX_FILES = ("index.ts", "index.tsx", "index.js", "index.jsx")


def _resolve_js_ts(source_path: str, module: str, all_paths: set[str]) -> str | None:
    if not module.startswith("."):
        return None
    base_dir = posixpath.dirname(source_path)
    candidate = posixpath.normpath(posixpath.join(base_dir, module))

    for ext in _JS_EXTENSIONS:
        probe = f"{candidate}{ext}"
        if probe in all_paths:
            return probe
    for index_file in _JS_INDEX_FILES:
        probe = posixpath.join(candidate, index_file)
        if probe in all_paths:
            return probe
    return None


def _resolve_python(source_path: str, module: str, all_paths: set[str]) -> str | None:
    if module.startswith("."):
        dots = len(module) - len(module.lstrip("."))
        remainder = module[dots:]
        base_dir = posixpath.dirname(source_path)
        for _ in range(dots - 1):
            base_dir = posixpath.dirname(base_dir)
        candidate = posixpath.normpath(posixpath.join(base_dir, remainder.replace(".", "/"))) if remainder else base_dir
    else:
        # Absolute intra-repo import (e.g. `from backend.config import x`) - common
        # in Python projects that don't use dot-relative imports at all. External
        # packages naturally won't match anything in all_paths.
        candidate = module.replace(".", "/")

    for probe in (f"{candidate}.py", posixpath.join(candidate, "__init__.py")):
        if probe in all_paths:
            return probe
    return None


def _resolve_java(module: str, all_paths: set[str]) -> str | None:
    """Java imports are fully-qualified (com.example.Foo); only resolve when that
    exact package/class path exists in this repo - external library imports
    naturally won't match anything and are correctly left unresolved."""
    suffix = module.replace(".", "/") + ".java"
    for path in all_paths:
        if path.endswith(suffix):
            return path
    return None


def resolve_import_target(source_path: str, module: str, language: str, all_paths: set[str]) -> str | None:
    if language in ("javascript", "typescript"):
        return _resolve_js_ts(source_path, module, all_paths)
    if language == "python":
        return _resolve_python(source_path, module, all_paths)
    if language == "java":
        return _resolve_java(module, all_paths)
    return None
