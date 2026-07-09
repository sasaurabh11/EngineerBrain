import re
from pathlib import Path

_PYTHON_FRAMEWORK_MARKERS = {
    "fastapi": "FastAPI",
    "flask": "Flask",
    "django": "Django",
}
_PYTHON_DEPENDENCY_FILES = ("requirements.txt", "pyproject.toml", "Pipfile")

_JS_FRAMEWORK_MARKERS = {
    "next": "Next.js",
    "nuxt": "Nuxt",
    "@nestjs/core": "NestJS",
    "express": "Express",
    "koa": "Koa",
    "fastify": "Fastify",
    "react": "React",
    "vue": "Vue",
    "@angular/core": "Angular",
}
_JS_DEPENDENCY_FILES = ("package.json",)

_JAVA_FRAMEWORK_MARKERS = {
    "spring-boot": "Spring Boot",
    "org.springframework.boot": "Spring Boot",
    "quarkus": "Quarkus",
    "micronaut": "Micronaut",
}
_JAVA_DEPENDENCY_FILES = ("pom.xml", "build.gradle", "build.gradle.kts")

_MARKER_GROUPS = (
    (_PYTHON_DEPENDENCY_FILES, _PYTHON_FRAMEWORK_MARKERS),
    (_JS_DEPENDENCY_FILES, _JS_FRAMEWORK_MARKERS),
    (_JAVA_DEPENDENCY_FILES, _JAVA_FRAMEWORK_MARKERS),
)


def detect_frameworks(root: Path) -> list[str]:
    detected: set[str] = set()

    for filenames, markers in _MARKER_GROUPS:
        for filename in filenames:
            file_path = root / filename
            if not file_path.exists():
                continue

            text = file_path.read_text(errors="ignore").lower()
            for marker, framework_name in markers.items():
                if re.search(rf"\b{re.escape(marker)}\b", text):
                    detected.add(framework_name)

    return sorted(detected)
