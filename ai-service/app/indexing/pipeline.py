import logging
import uuid
from pathlib import Path

from app.chunking.chunker import build_documentation_chunks, build_module_chunk, build_symbol_chunks
from app.embeddings.gemini_provider import GeminiEmbeddingProvider
from app.embeddings.gemini_provider import is_configured as embeddings_configured
from app.indexing.endpoint_detector import detect_decorator_endpoints
from app.indexing.file_walker import content_hash, walk_documentation_files, walk_supported_files
from app.indexing.framework_detector import detect_frameworks
from app.indexing.import_resolver import resolve_import_target
from app.indexing.schemas import (
    ApiEndpointPayload,
    ChunkPayload,
    FilePayload,
    GraphEdgePayload,
    IndexRequest,
    IndexResponse,
    SymbolPayload,
)
from app.parsers.base import ParsedFile, ParsedSymbol, SymbolKind
from app.parsers.registry import get_parser_for_file
from app.repository import clone_manager
from app.vectorstore import qdrant_store

logger = logging.getLogger(__name__)

FileProcessResult = tuple[FilePayload, list[SymbolPayload], list[ChunkPayload], list[GraphEdgePayload], list[ApiEndpointPayload]]


def _flatten_symbols(
    symbols: list[ParsedSymbol], file_path: str, parent_id: str | None = None
) -> tuple[list[SymbolPayload], list[tuple[str, ParsedSymbol]]]:
    """Assign a fresh UUID to every symbol (recursively), returning both the
    flat payload list and (id, symbol) pairs for downstream chunk-building."""
    payloads: list[SymbolPayload] = []
    id_pairs: list[tuple[str, ParsedSymbol]] = []

    for symbol in symbols:
        symbol_id = str(uuid.uuid4())
        payloads.append(
            SymbolPayload(
                id=symbol_id,
                parent_id=parent_id,
                file_path=file_path,
                kind=symbol.kind.value,
                name=symbol.name,
                start_line=symbol.start_line,
                end_line=symbol.end_line,
                signature=symbol.signature,
                doc_comment=symbol.doc_comment,
                metadata=symbol.metadata,
            )
        )
        id_pairs.append((symbol_id, symbol))

        if symbol.children:
            child_payloads, child_pairs = _flatten_symbols(symbol.children, file_path, parent_id=symbol_id)
            payloads.extend(child_payloads)
            id_pairs.extend(child_pairs)

    return payloads, id_pairs


def _extends_edges(symbol_id: str, symbol: ParsedSymbol) -> list[GraphEdgePayload]:
    if symbol.kind not in (SymbolKind.CLASS, SymbolKind.INTERFACE):
        return []

    edges: list[GraphEdgePayload] = []

    superclasses = symbol.metadata.get("superclasses")
    if superclasses:
        names = [name.strip() for name in superclasses.split(",") if name.strip()]
        edges.extend(
            GraphEdgePayload(source_symbol_id=symbol_id, target_package_name=name, edge_type="EXTENDS")
            for name in names
        )

    interfaces = symbol.metadata.get("interfaces")
    if interfaces:
        names = [name.strip() for name in interfaces.split(",") if name.strip()]
        edges.extend(
            GraphEdgePayload(source_symbol_id=symbol_id, target_package_name=name, edge_type="IMPLEMENTS")
            for name in names
        )

    return edges


def _import_edges(symbol_id: str, parsed: ParsedFile, relative_path: str, all_paths: set[str]) -> list[GraphEdgePayload]:
    edges: list[GraphEdgePayload] = []
    for imp in parsed.imports:
        target_file_path = resolve_import_target(relative_path, imp.module, parsed.language, all_paths)
        edges.append(
            GraphEdgePayload(
                source_symbol_id=symbol_id,
                target_package_name=imp.module,
                target_file_path=target_file_path,
                edge_type="IMPORTS",
            )
        )
    return edges


async def _build_chunks(
    parsed: ParsedFile,
    lines: list[str],
    relative_path: str,
    id_pairs: list[tuple[str, ParsedSymbol]],
    module_symbol_id: str | None,
) -> list[ChunkPayload]:
    chunks: list[ChunkPayload] = []

    module_chunk = build_module_chunk(parsed)
    if module_chunk is not None:
        chunks.append(
            ChunkPayload(
                id=str(uuid.uuid4()),
                symbol_id=module_symbol_id,
                file_path=relative_path,
                kind=module_chunk.kind,
                content=module_chunk.content,
                start_line=module_chunk.start_line,
                end_line=module_chunk.end_line,
                token_count=module_chunk.token_count,
            )
        )

    for symbol_id, symbol in id_pairs:
        for chunk in build_symbol_chunks(symbol, lines):
            chunks.append(
                ChunkPayload(
                    id=str(uuid.uuid4()),
                    symbol_id=symbol_id,
                    file_path=relative_path,
                    kind=chunk.kind,
                    content=chunk.content,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    token_count=chunk.token_count,
                )
            )

    return chunks


async def _embed_and_upsert(
    chunks: list[ChunkPayload],
    organization_id: str,
    repository_id: str,
    embedding_provider: GeminiEmbeddingProvider | None,
) -> None:
    if embedding_provider is None or not chunks:
        return

    vectors = await embedding_provider.embed([chunk.content for chunk in chunks])
    qdrant_store.upsert_chunks(
        [
            {
                "id": chunk.id,
                "vector": vector,
                "organization_id": organization_id,
                "repository_id": repository_id,
                "file_path": chunk.file_path,
                "kind": chunk.kind,
                "symbol_name": None,
            }
            for chunk, vector in zip(chunks, vectors)
        ]
    )
    for chunk in chunks:
        chunk.embedded = True


async def _process_file(
    repo_path: Path,
    file_abs_path: Path,
    organization_id: str,
    repository_id: str,
    embedding_provider: GeminiEmbeddingProvider | None,
    all_paths: set[str],
) -> FileProcessResult | None:
    relative_path = str(file_abs_path.relative_to(repo_path))
    parser = get_parser_for_file(relative_path)
    if parser is None:
        return None

    source_bytes = file_abs_path.read_bytes()
    parsed = parser.parse(relative_path, source_bytes)
    lines = source_bytes.decode("utf-8", errors="replace").splitlines()

    qdrant_store.delete_by_file(repository_id, relative_path)

    module_symbol_id = str(uuid.uuid4())
    module_symbol_payload = SymbolPayload(
        id=module_symbol_id,
        parent_id=None,
        file_path=relative_path,
        kind=SymbolKind.MODULE.value,
        name=relative_path,
        start_line=1,
        end_line=max(len(lines), 1),
        doc_comment=parsed.module_doc_comment,
    )

    symbol_payloads, id_pairs = _flatten_symbols(parsed.symbols, relative_path, parent_id=module_symbol_id)
    symbol_payloads.insert(0, module_symbol_payload)

    edges: list[GraphEdgePayload] = _import_edges(module_symbol_id, parsed, relative_path, all_paths)
    for symbol_id, symbol in id_pairs:
        edges.extend(_extends_edges(symbol_id, symbol))

    chunks = await _build_chunks(parsed, lines, relative_path, id_pairs, module_symbol_id=module_symbol_id)
    await _embed_and_upsert(chunks, organization_id, repository_id, embedding_provider)

    endpoints = detect_decorator_endpoints(symbol_payloads, relative_path)
    endpoints.extend(
        ApiEndpointPayload(symbol_id=None, file_path=relative_path, method=route.method, path=route.path, framework="Express")
        for route in parsed.routes
    )

    file_payload = FilePayload(
        path=relative_path,
        language=parsed.language,
        size_bytes=len(source_bytes),
        lines_of_code=parsed.lines_of_code,
        content_hash=content_hash(source_bytes),
    )

    return file_payload, symbol_payloads, chunks, edges, endpoints


async def _process_documentation_file(
    repo_path: Path,
    file_abs_path: Path,
    organization_id: str,
    repository_id: str,
    embedding_provider: GeminiEmbeddingProvider | None,
) -> tuple[FilePayload, list[ChunkPayload]]:
    relative_path = str(file_abs_path.relative_to(repo_path))
    source_bytes = file_abs_path.read_bytes()
    text = source_bytes.decode("utf-8", errors="replace")

    qdrant_store.delete_by_file(repository_id, relative_path)

    chunks = [
        ChunkPayload(
            id=str(uuid.uuid4()),
            symbol_id=None,
            file_path=relative_path,
            kind=chunk.kind,
            content=chunk.content,
            start_line=chunk.start_line,
            end_line=chunk.end_line,
            token_count=chunk.token_count,
        )
        for chunk in build_documentation_chunks(text)
    ]
    await _embed_and_upsert(chunks, organization_id, repository_id, embedding_provider)

    file_payload = FilePayload(
        path=relative_path,
        language="markdown",
        size_bytes=len(source_bytes),
        lines_of_code=len(text.splitlines()),
        content_hash=content_hash(source_bytes),
    )

    return file_payload, chunks


async def run_index(request: IndexRequest) -> IndexResponse:
    qdrant_store.ensure_collection()

    repo_path = clone_manager.ensure_repository(
        request.repository_id, request.clone_url, request.access_token, request.default_branch
    )

    previous_hashes = {f.path: f.content_hash for f in request.previous_files}
    current_files = walk_supported_files(repo_path)
    all_paths: set[str] = {str(p.relative_to(repo_path)) for p in current_files}
    current_paths: set[str] = set()

    embedding_provider = GeminiEmbeddingProvider() if embeddings_configured() else None
    if embedding_provider is None:
        logger.warning("Gemini embeddings not configured - chunks will be stored without embeddings")

    changed_files: list[FilePayload] = []
    all_symbols: list[SymbolPayload] = []
    all_chunks: list[ChunkPayload] = []
    all_edges: list[GraphEdgePayload] = []
    all_endpoints: list[ApiEndpointPayload] = []

    for file_abs_path in current_files:
        relative_path = str(file_abs_path.relative_to(repo_path))
        current_paths.add(relative_path)

        current_hash = content_hash(file_abs_path.read_bytes())
        if previous_hashes.get(relative_path) == current_hash:
            continue

        result = await _process_file(repo_path, file_abs_path, request.organization_id, request.repository_id, embedding_provider, all_paths)
        if result is None:
            continue

        file_payload, symbol_payloads, chunks, edges, endpoints = result
        changed_files.append(file_payload)
        all_symbols.extend(symbol_payloads)
        all_chunks.extend(chunks)
        all_edges.extend(edges)
        all_endpoints.extend(endpoints)

    for file_abs_path in walk_documentation_files(repo_path):
        relative_path = str(file_abs_path.relative_to(repo_path))
        current_paths.add(relative_path)

        current_hash = content_hash(file_abs_path.read_bytes())
        if previous_hashes.get(relative_path) == current_hash:
            continue

        file_payload, chunks = await _process_documentation_file(
            repo_path, file_abs_path, request.organization_id, request.repository_id, embedding_provider
        )
        changed_files.append(file_payload)
        all_chunks.extend(chunks)

    deleted_paths = [path for path in previous_hashes if path not in current_paths]
    for deleted_path in deleted_paths:
        qdrant_store.delete_by_file(request.repository_id, deleted_path)

    clone_manager.persist_to_archive(request.repository_id)

    return IndexResponse(
        new_commit_sha=clone_manager.get_current_commit_sha(request.repository_id),
        changed_files=changed_files,
        deleted_file_paths=deleted_paths,
        symbols=all_symbols,
        chunks=all_chunks,
        graph_edges=all_edges,
        api_endpoints=all_endpoints,
        detected_frameworks=detect_frameworks(repo_path),
        files_processed=len(changed_files),
    )
