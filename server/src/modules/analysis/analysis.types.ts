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
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface FindingResponseDto {
  id: string;
  category: string;
  type: string;
  severity: string;
  title: string;
  explanation: string;
  suggestedFix: string | null;
  confidence: number;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  symbolId: string | null;
  metadata: unknown;
}

// Mirrors ai-service's app/analysis/schemas.py AnalysisResponse
export interface AiAnalysisResult {
  overall_score: number;
  architecture_score: number;
  security_score: number;
  performance_score: number;
  maintainability_score: number;
  findings: {
    category: string;
    type: string;
    severity: string;
    title: string;
    explanation: string;
    suggested_fix: string | null;
    confidence: number;
    file_path: string | null;
    start_line: number | null;
    end_line: number | null;
    symbol_name: string | null;
    metadata: Record<string, unknown>;
  }[];
}
