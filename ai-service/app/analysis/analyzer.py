from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from app.parsers.base import ParsedFile


@dataclass
class AnalyzedFile:
    path: str
    language: str
    source: bytes
    parsed: ParsedFile


@dataclass
class AnalysisContext:
    repository_id: str
    repo_path: Path
    files: list[AnalyzedFile]
    dependency_manifests: dict[str, str]


@dataclass
class RawFinding:
    category: str
    type: str
    severity: str
    title: str
    explanation: str
    confidence: int
    file_path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    symbol_name: str | None = None
    suggested_fix: str | None = None
    metadata: dict = field(default_factory=dict)


class Analyzer(Protocol):
    name: str

    def analyze(self, context: AnalysisContext) -> list[RawFinding]: ...
