import type { AnalysisStatus } from "@prisma/client";

export interface AnalysisJobPayload {
  analysisId: string;
  repositoryId: string;
}

export interface RepositoryAnalysisResponseDto {
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
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface FindingResponseDto {
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
  symbolId: string | null;
  relatedFiles: string[];
  relatedClasses: string[];
  relatedFunctions: string[];
  metadata: unknown;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ListFindingsQuery {
  category?: string;
  severity?: string;
  priority?: string;
  page: number;
  pageSize: number;
  sortBy: "severity" | "priority" | "confidence" | "createdAt";
  sortOrder: "asc" | "desc";
}

export interface ListHistoryQuery {
  page: number;
  pageSize: number;
}

// Mirrors ai-service's app/analysis/schemas.py AnalysisResponse
export interface AiAnalysisResult {
  overall_score: number;
  architecture_score: number;
  security_score: number;
  performance_score: number;
  maintainability_score: number;
  scalability_score: number;
  modularity_score: number;
  layering_score: number;
  documentation_score: number;
  complexity_score: number;
  technical_debt_score: number;
  architecture_summary: string;
  findings: {
    category: string;
    type: string;
    severity: string;
    priority: string | null;
    title: string;
    explanation: string;
    evidence: string | null;
    suggested_fix: string | null;
    estimated_impact: string | null;
    confidence: number;
    file_path: string | null;
    start_line: number | null;
    end_line: number | null;
    symbol_name: string | null;
    related_files: string[];
    related_classes: string[];
    related_functions: string[];
    metadata: Record<string, unknown>;
  }[];
}
