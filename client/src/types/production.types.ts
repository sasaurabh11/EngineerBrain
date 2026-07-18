export type ProductionProvider = "PROMETHEUS" | "GITHUB_ACTIONS";
export type IntegrationStatus = "ACTIVE" | "DISABLED" | "ERROR";
export type ServiceCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DeploymentStatus = "SUCCESS" | "FAILED" | "ROLLED_BACK" | "IN_PROGRESS";
export type IncidentStatus = "DETECTED" | "INVESTIGATING" | "ROOT_CAUSED" | "RESOLVED" | "CLOSED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentSignalType = "DEPLOYMENT" | "COMMIT" | "PULL_REQUEST" | "FINDING" | "OWNERSHIP";
export type RecommendationType = "ROLLBACK" | "CONFIG_CHANGE" | "SCALING" | "CACHING" | "QUERY_OPTIMIZATION" | "INFRA_OPTIMIZATION";
export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PageInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Integration {
  id: string;
  provider: ProductionProvider;
  name: string;
  config: Record<string, unknown>;
  hasCredential: boolean;
  status: IntegrationStatus;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  repositoryId: string | null;
  ownerUserId: string | null;
  criticality: ServiceCriticality;
  createdAt: string;
}

export interface ServiceHealth {
  serviceId: string;
  source?: "live" | "snapshot";
  capturedAt: string | null;
  errorRate: number | null;
  p95LatencyMs: number | null;
  riskScore?: number | null;
  message?: string;
}

export interface Deployment {
  id: string;
  serviceId: string;
  repositoryId: string | null;
  pullRequestId: string | null;
  commitSha: string | null;
  version: string | null;
  environment: string;
  status: DeploymentStatus;
  deployedAt: string;
  sourceProvider: ProductionProvider;
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  serviceId: string | null;
  deploymentId: string | null;
  taskId: string | null;
  confidenceScore: number | null;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface IncidentSignal {
  id: string;
  signalType: IncidentSignalType;
  sourceRef: string | null;
  relevanceScore: number;
  summary: string;
}

export interface IncidentTimelineEvent {
  id: string;
  occurredAt: string;
  eventType: string;
  description: string;
  sourceRef: string | null;
}

export interface RootCauseAnalysis {
  summary: string;
  mostLikelyCause: string;
  confidenceScore: number;
  responsibleCommitSha: string | null;
  responsiblePullRequestId: string | null;
  responsibleServiceId: string | null;
  responsibleUserId: string | null;
  rollbackRecommended: boolean;
  generatedAt: string;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  priority: RecommendationPriority;
  estimatedImpact: string | null;
  confidenceScore: number;
}

export interface Postmortem {
  id: string;
  incidentId: string;
  executiveSummary: string;
  timelineMarkdown: string;
  rootCauseMarkdown: string;
  contributingFactors: string | null;
  customerImpact: string | null;
  recoverySteps: string | null;
  lessonsLearned: string | null;
  actionItems: { description: string }[] | null;
  generatedAt: string;
  publishedAt: string | null;
}
