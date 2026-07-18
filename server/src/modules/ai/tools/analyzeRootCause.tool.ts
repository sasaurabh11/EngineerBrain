import { NotFoundError } from "../../../common/errors/AppError.ts";
import { callAgentStepWithRetry } from "../agents/agentClient.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

interface ParsedRootCause {
  summary: string;
  mostLikelyCause: string;
  confidenceScore: number;
  responsibleCommitSha: string | null;
  responsiblePullRequestId: string | null;
  responsibleUserId: string | null;
  rollbackRecommended: boolean;
}

function parseRootCauseJson(text: string): ParsedRootCause {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Root cause analysis response was not valid JSON");
  const parsed = JSON.parse(match[0]) as Partial<ParsedRootCause>;
  if (!parsed.mostLikelyCause || typeof parsed.confidenceScore !== "number") {
    throw new Error("Root cause analysis response is missing required fields");
  }
  return {
    summary: parsed.summary ?? parsed.mostLikelyCause,
    mostLikelyCause: parsed.mostLikelyCause,
    confidenceScore: Math.max(0, Math.min(100, parsed.confidenceScore)),
    responsibleCommitSha: parsed.responsibleCommitSha ?? null,
    responsiblePullRequestId: parsed.responsiblePullRequestId ?? null,
    responsibleUserId: parsed.responsibleUserId ?? null,
    rollbackRecommended: Boolean(parsed.rollbackRecommended),
  };
}

/** Reasons ONLY over already-correlated IncidentSignal evidence (never raw
 * logs/metrics) - deterministic signals first, per the "use LLM reasoning
 * only after structured evidence is collected" requirement. Then grounds
 * the LLM's claimed commit/PR/service against that same evidence set in
 * code (not another LLM call) before persisting anything, so a hallucinated
 * commit SHA can never reach the dashboard. */
export const analyzeRootCauseTool: AiTool<Args> = {
  name: "analyze_root_cause",
  description:
    "Analyzes an incident's already-correlated evidence (call correlate_incident_evidence first) to determine the most likely root cause, a " +
    "confidence score, the responsible commit/PR/service/owner if identifiable, and whether a rollback is recommended. Persists the result.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");

    const signals = await productionRepository.listSignals(incident.id);

    // Genuinely no correlatable evidence exists (e.g. the incident's service
    // has no linked repository/deployment/owner yet) - this is a real,
    // honest outcome, not a bug, and shouldn't fail the whole pipeline. Persist
    // a zero-confidence "insufficient evidence" conclusion instead of guessing.
    if (signals.length === 0) {
      const rootCause = await productionRepository.upsertRootCause(incident.id, {
        summary: "No deployment, commit, pull request, finding, or ownership evidence could be correlated for this incident.",
        mostLikelyCause: "Insufficient evidence to determine a root cause",
        confidenceScore: 0,
        responsibleCommitSha: null,
        responsiblePullRequestId: null,
        responsibleServiceId: incident.serviceId,
        responsibleUserId: null,
        rollbackRecommended: false,
      });
      await productionRepository.setConfidence(incident.id, 0);
      return rootCause;
    }

    const evidenceText = signals
      .map((s) => `- [${s.signalType}] (ref: ${s.sourceRef ?? "none"}, relevance: ${s.relevanceScore}) ${s.summary}`)
      .join("\n");

    const prompt =
      `You are investigating a production incident titled "${incident.title}" (severity ${incident.severity}). Below is the ONLY evidence available - ` +
      "reason strictly from it, never invent a commit SHA, PR id, service id, or user id that isn't explicitly present in this evidence.\n\n" +
      `${evidenceText}\n\n` +
      "Respond with ONLY a JSON object (no markdown fences) with these exact keys: summary (string), mostLikelyCause (string), confidenceScore " +
      "(0-100 integer), responsibleCommitSha (string or null - MUST match a commit sha literally present above, else null), responsiblePullRequestId " +
      "(string or null - MUST match a sourceRef literally present above for a PULL_REQUEST signal, else null), " +
      "responsibleUserId (string or null - MUST match a sourceRef literally present above for an OWNERSHIP signal, else null), rollbackRecommended (boolean).";

    const result = await callAgentStepWithRetry("synthesizer", [{ role: "user", content: prompt }]);
    const parsed = parseRootCauseJson(result.message.content ?? "");

    // Deterministic grounding check - the LLM's claims must reference
    // evidence that actually exists, not something it inferred/invented.
    const knownRefs = new Set(signals.map((s) => s.sourceRef).filter((ref): ref is string => ref !== null));
    if (parsed.responsibleCommitSha && !signals.some((s) => s.signalType === "COMMIT" && s.sourceRef === parsed.responsibleCommitSha)) {
      parsed.responsibleCommitSha = null;
    }
    if (parsed.responsiblePullRequestId && !knownRefs.has(parsed.responsiblePullRequestId)) {
      parsed.responsiblePullRequestId = null;
    }
    if (parsed.responsibleUserId && !knownRefs.has(parsed.responsibleUserId)) {
      parsed.responsibleUserId = null;
    }

    // The "responsible service" is the incident's own service in the vast
    // majority of cases - set deterministically rather than trust the LLM
    // to reliably echo back a real service UUID it was never shown.
    const rootCause = await productionRepository.upsertRootCause(incident.id, { ...parsed, responsibleServiceId: incident.serviceId });
    await productionRepository.setConfidence(incident.id, parsed.confidenceScore);

    return rootCause;
  },
};
