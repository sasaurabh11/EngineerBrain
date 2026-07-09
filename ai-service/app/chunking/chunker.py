import re
from dataclasses import dataclass

from app.parsers.base import ParsedFile, ParsedSymbol, SymbolKind

MAX_CHUNK_CHARS = 8000
OVERLAP_LINES = 5

_HEADING_RE = re.compile(r"^#{1,6}\s+.+$")


@dataclass
class Chunk:
    kind: str
    content: str
    start_line: int
    end_line: int
    token_count: int


def _extract_lines(lines: list[str], start_line: int, end_line: int) -> str:
    return "\n".join(lines[start_line - 1 : end_line])


def _estimate_tokens(content: str) -> int:
    return max(1, len(content) // 4)


def _split_oversized(content: str, start_line: int) -> list[tuple[str, int, int]]:
    """Split content exceeding MAX_CHUNK_CHARS into overlapping line windows.

    Returns (content, start_line, end_line) tuples with 1-indexed, file-relative line numbers.
    """
    if len(content) <= MAX_CHUNK_CHARS:
        return [(content, start_line, start_line + content.count("\n"))]

    lines = content.splitlines()
    pieces: list[tuple[str, int, int]] = []
    index = 0
    while index < len(lines):
        piece_lines: list[str] = []
        piece_len = 0
        piece_start = index
        while index < len(lines) and piece_len < MAX_CHUNK_CHARS:
            piece_lines.append(lines[index])
            piece_len += len(lines[index]) + 1
            index += 1

        pieces.append(("\n".join(piece_lines), start_line + piece_start, start_line + index - 1))

        if index >= len(lines):
            break
        index = max(index - OVERLAP_LINES, piece_start + 1)

    return pieces


def build_module_chunk(parsed_file: ParsedFile) -> Chunk | None:
    parts: list[str] = []
    if parsed_file.module_doc_comment:
        parts.append(parsed_file.module_doc_comment)

    if parsed_file.imports:
        import_lines = [
            f"from {imp.module} import {', '.join(imp.imported_names)}" if imp.imported_names else f"import {imp.module}"
            for imp in parsed_file.imports
        ]
        parts.append("\n".join(import_lines))

    if not parts:
        return None

    content = "\n\n".join(parts)
    return Chunk(kind=SymbolKind.MODULE.value, content=content, start_line=1, end_line=1, token_count=_estimate_tokens(content))


def _class_summary_content(symbol: ParsedSymbol) -> str:
    parts = [symbol.signature or f"class {symbol.name}"]
    if symbol.doc_comment:
        parts.append(f'"""{symbol.doc_comment}"""')
    for method in symbol.children:
        parts.append(f"    {method.signature}")
    return "\n".join(parts)


def build_symbol_chunks(symbol: ParsedSymbol, lines: list[str]) -> list[Chunk]:
    """Chunk(s) for a single symbol. Usually one chunk; more only if the content is oversized."""
    if symbol.kind == SymbolKind.CLASS:
        content = _class_summary_content(symbol)
    else:
        content = _extract_lines(lines, symbol.start_line, symbol.end_line)

    pieces = _split_oversized(content, symbol.start_line)
    return [
        Chunk(kind=symbol.kind.value, content=piece, start_line=start, end_line=end, token_count=_estimate_tokens(piece))
        for piece, start, end in pieces
    ]


def build_documentation_chunks(content: str) -> list[Chunk]:
    """Splits a markdown file into one chunk per heading section (so search results
    land on a coherent section rather than an arbitrary character window)."""
    lines = content.splitlines()
    heading_indices = [i for i, line in enumerate(lines) if _HEADING_RE.match(line)]

    if not heading_indices:
        pieces = _split_oversized(content, 1)
        return [
            Chunk(kind="DOCUMENTATION", content=piece, start_line=start, end_line=end, token_count=_estimate_tokens(piece))
            for piece, start, end in pieces
        ]

    sections: list[tuple[int, int]] = []
    if heading_indices[0] > 0:
        sections.append((0, heading_indices[0] - 1))
    for i, heading_index in enumerate(heading_indices):
        end = heading_indices[i + 1] - 1 if i + 1 < len(heading_indices) else len(lines) - 1
        sections.append((heading_index, end))

    chunks: list[Chunk] = []
    for start_idx, end_idx in sections:
        section_text = "\n".join(lines[start_idx : end_idx + 1]).strip()
        if not section_text:
            continue
        for piece, start, end in _split_oversized(section_text, start_idx + 1):
            chunks.append(
                Chunk(kind="DOCUMENTATION", content=piece, start_line=start, end_line=end, token_count=_estimate_tokens(piece))
            )

    return chunks
