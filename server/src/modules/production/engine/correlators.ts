import { prisma } from "../../../database/prisma.ts";

const DEPLOYMENT_LOOKBACK_MS = 6 * 60 * 60 * 1000; // 6h - deployments older than this are unlikely to be the cause
const RECENT_FINDING_LIMIT = 5;

export interface CorrelatedSignal {
  signalType: "DEPLOYMENT" | "COMMIT" | "PULL_REQUEST" | "FINDING" | "OWNERSHIP";
  sourceRef: string | null;
  relevanceScore: number;
  summary: string;
  rawData?: Record<string, unknown>;
}

/** Each correlator below is a small, independent, deterministic function -
 * no LLM involved. They run together (see correlateIncidentEvidence.tool.ts)
 * and their output (IncidentSignal rows) is the ONLY thing the LLM root-
 * cause step reasons over - never raw logs/metrics. */

export async function correlateDeployment(organizationId: string, serviceId: string | null, detectedAt: Date): Promise<CorrelatedSignal | null> {
  if (!serviceId) return null;

  const deployment = await prisma.deployment.findFirst({
    where: { organizationId, serviceId, deployedAt: { lte: detectedAt } },
    orderBy: { deployedAt: "desc" },
  });
  if (!deployment) return null;

  const ageMs = detectedAt.getTime() - deployment.deployedAt.getTime();
  const withinLookback = ageMs <= DEPLOYMENT_LOOKBACK_MS;

  return {
    signalType: "DEPLOYMENT",
    sourceRef: deployment.id,
    relevanceScore: withinLookback ? 90 : 40,
    summary: `${withinLookback ? "Recent" : "Prior"} deployment ${deployment.version ?? deployment.commitSha?.slice(0, 7) ?? deployment.id} to "${deployment.environment}" ${Math.round(ageMs / 60000)}m before detection (status: ${deployment.status}).`,
    rawData: { deploymentId: deployment.id, deployedAt: deployment.deployedAt.toISOString(), status: deployment.status },
  };
}

export async function correlateCommit(repositoryId: string | null, commitSha: string | null): Promise<CorrelatedSignal | null> {
  if (!repositoryId || !commitSha) return null;

  const commit = await prisma.commit.findFirst({ where: { repositoryId, sha: commitSha } });
  if (!commit) return null;

  return {
    signalType: "COMMIT",
    sourceRef: commit.sha,
    relevanceScore: 85,
    summary: `Deployed commit ${commit.sha.slice(0, 7)} by ${commit.authorGithubLogin ?? commit.authorName}: "${commit.message.split("\n")[0]}"`,
    rawData: { sha: commit.sha, authorGithubLogin: commit.authorGithubLogin, authorEmail: commit.authorEmail },
  };
}

/** Best-effort heuristic only: this platform doesn't store which commit
 * merged from which PR (GitHub's merge-commit link isn't captured today), so
 * this picks the most recently MERGED pull request on the repository before
 * the deployment - a reasonable proxy, not a guaranteed match. Documented
 * honestly in the tool's response, not presented as certain. */
export async function correlateMostRecentMergedPullRequest(repositoryId: string | null, before: Date): Promise<CorrelatedSignal | null> {
  if (!repositoryId) return null;

  const pr = await prisma.pullRequest.findFirst({
    where: { repositoryId, state: "MERGED", mergedAt: { lte: before } },
    orderBy: { mergedAt: "desc" },
  });
  if (!pr) return null;

  return {
    signalType: "PULL_REQUEST",
    sourceRef: pr.id,
    relevanceScore: 60,
    summary: `Most recently merged PR before this deployment: #${pr.number} "${pr.title}" by ${pr.authorLogin} (best-effort match - not a confirmed merge-commit link).`,
    rawData: { pullRequestId: pr.id, number: pr.number, authorLogin: pr.authorLogin },
  };
}

export async function correlateRecentFindings(repositoryId: string | null): Promise<CorrelatedSignal[]> {
  if (!repositoryId) return [];

  const findings = await prisma.finding.findMany({
    where: {
      analysis: { repositoryId },
      severity: { in: ["HIGH", "CRITICAL"] },
    },
    orderBy: { createdAt: "desc" },
    take: RECENT_FINDING_LIMIT,
  });

  return findings.map((finding) => ({
    signalType: "FINDING" as const,
    sourceRef: finding.id,
    relevanceScore: finding.severity === "CRITICAL" ? 70 : 55,
    summary: `Existing ${finding.severity} ${finding.category.toLowerCase()} finding: "${finding.title}"${finding.filePath ? ` (${finding.filePath})` : ""}`,
    rawData: { findingId: finding.id, category: finding.category, severity: finding.severity },
  }));
}

export async function correlateOwnership(serviceOwnerUserId: string | null, commitAuthorEmail: string | null): Promise<CorrelatedSignal | null> {
  if (serviceOwnerUserId) {
    const owner = await prisma.user.findUnique({ where: { id: serviceOwnerUserId } });
    if (owner) {
      return {
        signalType: "OWNERSHIP",
        sourceRef: owner.id,
        relevanceScore: 50,
        summary: `Service owner: ${owner.name} (${owner.email})`,
        rawData: { userId: owner.id },
      };
    }
  }

  if (commitAuthorEmail) {
    const author = await prisma.user.findFirst({ where: { email: commitAuthorEmail } });
    if (author) {
      return {
        signalType: "OWNERSHIP",
        sourceRef: author.id,
        relevanceScore: 45,
        summary: `Deploying commit's author (also an EngineerBrain member): ${author.name}`,
        rawData: { userId: author.id },
      };
    }
  }

  return null;
}
