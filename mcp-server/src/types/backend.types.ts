// Hand-maintained mirror of the subset of Express response DTOs this server
// actually consumes - not a generated client, so keep it in sync deliberately
// as new tools are added rather than mirroring the whole backend surface.

export interface MeResponseDto {
  id: string;
  name: string;
  email: string;
  apiKeyOrganization?: {
    id: string;
    slug: string;
    name: string;
    role: string;
  } | null;
}

export interface RepositoryResponseDto {
  id: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  ownerLogin: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "INTERNAL";
  defaultBranch: string;
  primaryLanguage: string | null;
  topics: string[];
  htmlUrl: string;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  sizeKb: number;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  lastSyncedAt: string | null;
}

export interface RepositoryIndexResponseDto {
  status: "PENDING" | "INDEXING" | "INDEXED" | "FAILED";
  lastIndexedAt: string | null;
  detectedFrameworks: string[];
  totalFiles: number;
  totalSymbols: number;
  totalChunks: number;
}

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
  symbolId: string | null;
  filePath: string;
  method: string;
  path: string;
  framework: string;
}

export interface FileContentResponseDto {
  path: string;
  content: string;
}

export interface SymbolSourceMatch {
  name: string;
  kind: string;
  filePath: string;
  repositoryId: string;
  startLine: number;
  endLine: number;
  signature: string | null;
  docComment: string | null;
  source: string;
  truncated: boolean;
}

export type SymbolSourceResult = { found: false; message: string } | { found: true; matches: SymbolSourceMatch[] };

export interface RepositoryAnalysisResponseDto {
  id: string;
  status: string;
  overallScore: number | null;
  architectureScore: number | null;
  securityScore: number | null;
  performanceScore: number | null;
  maintainabilityScore: number | null;
  scalabilityScore: number | null;
  modularityScore: number | null;
  layeringScore: number | null;
  documentationScore: number | null;
  complexityScore: number | null;
  technicalDebtScore: number | null;
  architectureSummary: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface FindingDto {
  id: string;
  category: string;
  type: string;
  severity: string;
  priority: string | null;
  title: string;
  explanation: string;
  evidence: string | null;
  suggestedFix: string | null;
  estimatedImpact: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  relatedFiles: string[];
  relatedClasses: string[];
  relatedFunctions: string[];
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface FindingsPageDto {
  items: FindingDto[];
  pageInfo: PageInfo;
}

export interface WorkflowParamDescriptor {
  key: string;
  label: string;
  type: "number" | "string";
  required: boolean;
}

export interface WorkflowDescriptor {
  key: string;
  name: string;
  description: string;
  params: WorkflowParamDescriptor[];
}

export type TaskStatus = "QUEUED" | "RUNNING" | "PENDING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface TaskResponseDto {
  id: string;
  organizationId: string;
  repositoryId: string | null;
  workflowKey: string | null;
  goal: string;
  status: TaskStatus;
  progress: number;
  resultSummary: string | null;
  errorMessage: string | null;
  pendingStepId: string | null;
  createdAt: string;
}

export interface AgentExecutionResponseDto {
  id: string;
  agentKey: string;
  stepIndex: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  output: unknown;
}

export interface ConversationResponseDto {
  id: string;
  title: string | null;
  repositoryId: string | null;
}

export interface Citation {
  filePath: string;
  repositoryId: string;
}

export type AiStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; name: string; args: Record<string, unknown> }
  | { type: "tool-result"; name: string; status: "SUCCESS" | "FAILED" }
  | { type: "done"; messageId: string; citations: Citation[] }
  | { type: "error"; message: string };
