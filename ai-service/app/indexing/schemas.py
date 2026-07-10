from pydantic import BaseModel


class PreviousFile(BaseModel):
    path: str
    content_hash: str


class IndexRequest(BaseModel):
    organization_id: str
    repository_id: str
    clone_url: str
    access_token: str
    default_branch: str
    previous_files: list[PreviousFile] = []


class FilePayload(BaseModel):
    path: str
    language: str
    size_bytes: int
    lines_of_code: int
    content_hash: str


class SymbolPayload(BaseModel):
    id: str
    parent_id: str | None = None
    file_path: str
    kind: str
    name: str
    start_line: int
    end_line: int
    signature: str | None = None
    doc_comment: str | None = None
    metadata: dict = {}


class ChunkPayload(BaseModel):
    id: str
    symbol_id: str | None
    file_path: str
    kind: str
    content: str
    start_line: int
    end_line: int
    token_count: int
    embedded: bool = False


class GraphEdgePayload(BaseModel):
    source_symbol_id: str
    target_symbol_id: str | None = None
    target_package_name: str | None = None
    target_file_path: str | None = None
    edge_type: str


class ApiEndpointPayload(BaseModel):
    symbol_id: str | None
    file_path: str
    method: str
    path: str
    framework: str


class IndexResponse(BaseModel):
    new_commit_sha: str
    changed_files: list[FilePayload]
    deleted_file_paths: list[str]
    symbols: list[SymbolPayload]
    chunks: list[ChunkPayload]
    graph_edges: list[GraphEdgePayload]
    api_endpoints: list[ApiEndpointPayload]
    detected_frameworks: list[str]
    files_processed: int
