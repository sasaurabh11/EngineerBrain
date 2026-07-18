import type {
  DeploymentStatus,
  IncidentSeverity,
  IncidentSignalType,
  IncidentStatus,
  IntegrationStatus,
  ProductionProvider,
  RecommendationPriority,
  RecommendationType,
  ServiceCriticality,
} from "@prisma/client";

export interface IntegrationResponseDto {
  id: string;
  provider: ProductionProvider;
  name: string;
  config: Record<string, unknown>;
  hasCredential: boolean;
  status: IntegrationStatus;
  createdAt: Date;
}

export interface ServiceResponseDto {
  id: string;
  name: string;
  repositoryId: string | null;
  ownerUserId: string | null;
  criticality: ServiceCriticality;
  createdAt: Date;
}

export interface ServiceHealthResponseDto {
  serviceId: string;
  capturedAt: Date;
  errorRate: number | null;
  p95LatencyMs: number | null;
  riskScore: number | null;
}

export interface DeploymentResponseDto {
  id: string;
  serviceId: string;
  repositoryId: string | null;
  pullRequestId: string | null;
  commitSha: string | null;
  version: string | null;
  environment: string;
  status: DeploymentStatus;
  deployedAt: Date;
  sourceProvider: ProductionProvider;
}

export interface IncidentSignalResponseDto {
  id: string;
  signalType: IncidentSignalType;
  sourceRef: string | null;
  relevanceScore: number;
  summary: string;
}

export interface IncidentTimelineEventResponseDto {
  id: string;
  occurredAt: Date;
  eventType: string;
  description: string;
  sourceRef: string | null;
}

export interface RootCauseAnalysisResponseDto {
  summary: string;
  mostLikelyCause: string;
  confidenceScore: number;
  responsibleCommitSha: string | null;
  responsiblePullRequestId: string | null;
  responsibleServiceId: string | null;
  responsibleUserId: string | null;
  rollbackRecommended: boolean;
  generatedAt: Date;
}

export interface RecommendationResponseDto {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: RecommendationPriority;
  estimatedImpact: string | null;
  confidenceScore: number;
}

export interface IncidentResponseDto {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  serviceId: string | null;
  deploymentId: string | null;
  taskId: string | null;
  confidenceScore: number | null;
  detectedAt: Date;
  resolvedAt: Date | null;
}

export interface PostmortemResponseDto {
  id: string;
  incidentId: string;
  executiveSummary: string;
  timelineMarkdown: string;
  rootCauseMarkdown: string;
  contributingFactors: string | null;
  customerImpact: string | null;
  recoverySteps: string | null;
  lessonsLearned: string | null;
  actionItems: unknown;
  generatedAt: Date;
  publishedAt: Date | null;
}

export interface ListIncidentsFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  serviceId?: string;
  page: number;
  pageSize: number;
}

export interface ListDeploymentsFilters {
  serviceId?: string;
  environment?: string;
  status?: DeploymentStatus;
  page: number;
  pageSize: number;
}
