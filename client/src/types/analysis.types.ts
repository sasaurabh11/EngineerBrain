export type AnalysisStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type FindingCategory = "QUALITY" | "SECURITY" | "PERFORMANCE" | "ARCHITECTURE" | "DEPENDENCY" | "PATTERN" | "SOLID";
export type FindingSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RepositoryAnalysis {
  id: string;
  status: AnalysisStatus;
  overallScore: number | null;
  architectureScore: number | null;
  securityScore: number | null;
  performanceScore: number | null;
  maintainabilityScore: number | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  type: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  suggestedFix: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  symbolId: string | null;
  metadata: { cycle?: string[]; [key: string]: unknown } | null;
}
