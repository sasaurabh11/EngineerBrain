export type AnalysisStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRY" | "CANCELLED";
export type FindingCategory = "QUALITY" | "SECURITY" | "PERFORMANCE" | "ARCHITECTURE" | "DEPENDENCY" | "PATTERN" | "SOLID";
export type FindingSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FindingSortField = "severity" | "priority" | "confidence" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface RepositoryAnalysis {
  id: string;
  status: AnalysisStatus;
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
  retryCount: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  type: string;
  severity: FindingSeverity;
  priority: FindingSeverity | null;
  title: string;
  explanation: string;
  evidence: string | null;
  suggestedFix: string | null;
  estimatedImpact: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  symbolId: string | null;
  relatedFiles: string[];
  relatedClasses: string[];
  relatedFunctions: string[];
  metadata: { cycle?: string[]; [key: string]: unknown } | null;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface FindingsFilters {
  category?: FindingCategory;
  severity?: FindingSeverity;
  priority?: FindingSeverity;
  page?: number;
  pageSize?: number;
  sortBy?: FindingSortField;
  sortOrder?: SortOrder;
}
