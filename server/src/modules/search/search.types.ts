export interface SearchResultDto {
  chunkId: string;
  score: number;
  repositoryId: string;
  repositoryName: string;
  filePath: string;
  kind: string;
  symbolName: string | null;
  content: string;
}

export interface AiSearchResult {
  results: {
    chunk_id: string;
    score: number;
    repository_id: string;
    file_path: string;
    kind: string;
  }[];
}
