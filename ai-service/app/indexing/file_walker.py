import hashlib
from pathlib import Path

from app.parsers.registry import is_supported_file

IGNORED_DIR_NAMES = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "venv",
    ".venv",
    "__pycache__",
    "target",
    ".next",
    ".turbo",
    "vendor",
    "coverage",
    ".pytest_cache",
}

MAX_FILE_SIZE_BYTES = 1_000_000
DOCUMENTATION_EXTENSIONS = (".md", ".mdx")


def _walk_files(root: Path, predicate) -> list[Path]:
    matches: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORED_DIR_NAMES for part in path.relative_to(root).parts):
            continue
        if path.stat().st_size > MAX_FILE_SIZE_BYTES:
            continue
        if predicate(path):
            matches.append(path)
    return matches


def walk_supported_files(root: Path) -> list[Path]:
    return _walk_files(root, lambda path: is_supported_file(str(path)))


def walk_documentation_files(root: Path) -> list[Path]:
    return _walk_files(root, lambda path: path.suffix.lower() in DOCUMENTATION_EXTENSIONS)


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
