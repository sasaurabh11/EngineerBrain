export type IndexStatus = "PENDING" | "INDEXING" | "INDEXED" | "FAILED";

export interface RepositoryIndexStatus {
  status: IndexStatus;
  lastIndexedAt: string | null;
  detectedFrameworks: string[];
  totalFiles: number;
  totalSymbols: number;
  totalChunks: number;
}
