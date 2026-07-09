from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


class SymbolKind(str, Enum):
    MODULE = "MODULE"
    CLASS = "CLASS"
    INTERFACE = "INTERFACE"
    FUNCTION = "FUNCTION"
    METHOD = "METHOD"


@dataclass
class ParsedSymbol:
    kind: SymbolKind
    name: str
    start_line: int
    end_line: int
    signature: str | None = None
    doc_comment: str | None = None
    metadata: dict = field(default_factory=dict)
    children: list["ParsedSymbol"] = field(default_factory=list)


@dataclass
class ParsedImport:
    module: str
    imported_names: list[str] = field(default_factory=list)


@dataclass
class ParsedFile:
    path: str
    language: str
    lines_of_code: int
    imports: list[ParsedImport] = field(default_factory=list)
    symbols: list[ParsedSymbol] = field(default_factory=list)
    module_doc_comment: str | None = None


class BaseParser(ABC):
    language: str
    file_extensions: tuple[str, ...]

    @abstractmethod
    def parse(self, file_path: str, source_code: bytes) -> ParsedFile:
        raise NotImplementedError
