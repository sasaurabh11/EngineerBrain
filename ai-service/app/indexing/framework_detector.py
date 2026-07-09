import re
from pathlib import Path

_PYTHON_FRAMEWORK_MARKERS = {
    "fastapi": "FastAPI",
    "flask": "Flask",
    "django": "Django",
}

_PYTHON_DEPENDENCY_FILES = ("requirements.txt", "pyproject.toml", "Pipfile")


def detect_frameworks(root: Path) -> list[str]:
    detected: set[str] = set()

    for filename in _PYTHON_DEPENDENCY_FILES:
        file_path = root / filename
        if not file_path.exists():
            continue

        text = file_path.read_text(errors="ignore").lower()
        for marker, framework_name in _PYTHON_FRAMEWORK_MARKERS.items():
            if re.search(rf"\b{marker}\b", text):
                detected.add(framework_name)

    return sorted(detected)
