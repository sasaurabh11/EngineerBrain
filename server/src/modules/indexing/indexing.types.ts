import type { IndexStatus } from "@prisma/client";

export interface IndexJobPayload {
  indexingJobId: string;
  repositoryId: string;
  forceFull: boolean;
}

export interface RepositoryIndexResponseDto {
  status: IndexStatus;
  lastIndexedAt: Date | null;
  detectedFrameworks: string[];
  totalFiles: number;
  totalSymbols: number;
  totalChunks: number;
}

export interface RepositoryFileResponseDto {
  id: string;
  path: string;
  language: string;
  sizeBytes: number;
  linesOfCode: number;
}

export interface CodeSymbolResponseDto {
  id: string;
  kind: string;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  signature: string | null;
  docComment: string | null;
  parentSymbolId: string | null;
}

export interface CodeGraphEdgeResponseDto {
  id: string;
  sourceSymbolId: string;
  targetSymbolId: string | null;
  targetPackageName: string | null;
  edgeType: string;
}

export interface ApiEndpointResponseDto {
  id: string;
  method: string;
  path: string;
  framework: string;
  filePath: string;
  symbolId: string | null;
}

// Mirrors ai-service's app/indexing/schemas.py IndexResponse
export interface AiIndexResult {
  new_commit_sha: string;
  changed_files: {
    path: string;
    language: string;
    size_bytes: number;
    lines_of_code: number;
    content_hash: string;
  }[];
  deleted_file_paths: string[];
  symbols: {
    id: string;
    parent_id: string | null;
    file_path: string;
    kind: string;
    name: string;
    start_line: number;
    end_line: number;
    signature: string | null;
    doc_comment: string | null;
    metadata: Record<string, unknown>;
  }[];
  chunks: {
    id: string;
    symbol_id: string | null;
    file_path: string;
    kind: string;
    content: string;
    start_line: number;
    end_line: number;
    token_count: number;
    embedded: boolean;
  }[];
  graph_edges: {
    source_symbol_id: string;
    target_symbol_id: string | null;
    target_package_name: string | null;
    target_file_path: string | null;
    edge_type: string;
  }[];
  api_endpoints: {
    symbol_id: string | null;
    file_path: string;
    method: string;
    path: string;
    framework: string;
  }[];
  detected_frameworks: string[];
  files_processed: number;
}
