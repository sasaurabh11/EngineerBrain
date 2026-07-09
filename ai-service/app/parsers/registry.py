from app.parsers.base import BaseParser
from app.parsers.java_parser import JavaParser
from app.parsers.js_ts_parser import JavaScriptParser, TsxParser, TypeScriptParser
from app.parsers.python_parser import PythonParser

_PARSERS: list[BaseParser] = [PythonParser(), JavaScriptParser(), TypeScriptParser(), TsxParser(), JavaParser()]

_EXTENSION_MAP: dict[str, BaseParser] = {ext: parser for parser in _PARSERS for ext in parser.file_extensions}


def get_parser_for_file(file_path: str) -> BaseParser | None:
    for extension, parser in _EXTENSION_MAP.items():
        if file_path.endswith(extension):
            return parser
    return None


def is_supported_file(file_path: str) -> bool:
    return get_parser_for_file(file_path) is not None
