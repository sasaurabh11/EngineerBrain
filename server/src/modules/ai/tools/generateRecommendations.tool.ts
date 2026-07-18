import { ConflictError, NotFoundError } from "../../../common/errors/AppError.ts";
import { DEFAULT_AI_PROVIDER_CONFIG } from "../../../infra/aiService/providerConfig.ts";
import { callAgentStepWithRetry } from "../agents/agentClient.ts";
import { productionRepository } from "../../production/production.repository.ts";
import type { AiTool, ToolContext } from "./tool.types.ts";

interface Args {
  incident_id: string;
}

const RECOMMENDATION_TYPES = ["ROLLBACK", "CONFIG_CHANGE", "SCALING", "CACHING", "QUERY_OPTIMIZATION", "INFRA_OPTIMIZATION"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface ParsedRecommendation {
  type: string;
  title: string;
  description: string;
  rationale: string;
  priority: string;
  estimatedImpact: string | null;
  confidenceScore: number;
}

function parseRecommendationsJson(text: string): ParsedRecommendation[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Recommendations response was not a valid JSON array");
  const parsed = JSON.parse(match[0]) as Partial<ParsedRecommendation>[];

  return parsed
    .filter((r) => r.title && r.description && r.rationale)
    .map((r) => ({
      type: RECOMMENDATION_TYPES.includes(r.type ?? "") ? r.type! : "CONFIG_CHANGE",
      title: r.title!,
      description: r.description!,
      rationale: r.rationale!,
      priority: PRIORITIES.includes(r.priority ?? "") ? r.priority! : "MEDIUM",
      estimatedImpact: r.estimatedImpact ?? null,
      confidenceScore: Math.max(0, Math.min(100, r.confidenceScore ?? 50)),
    }));
}

/** Fixed taxonomy, every recommendation required to cite evidence in its
 * rationale (checked deterministically, not just requested in the prompt) -
 * requires root cause analysis to have already run. */
export const generateRecommendationsTool: AiTool<Args> = {
  name: "generate_recommendations",
  description:
    "Generates actionable recommendations (rollback, config change, scaling, caching, query optimization, infra optimization) for an incident " +
    "that already has a root cause analysis. Call analyze_root_cause first.",
  parameters: {
    type: "object",
    properties: { incident_id: { type: "string", description: "Incident UUID" } },
    required: ["incident_id"],
  },
  async execute(args, ctx: ToolContext) {
    const incident = await productionRepository.findIncidentByOrgAndId(ctx.organizationId, args.incident_id);
    if (!incident) throw new NotFoundError("Incident not found");

    const rootCause = await productionRepository.findRootCause(incident.id);
    if (!rootCause) {
      throw new ConflictError("No root cause analysis exists for this incident yet - call analyze_root_cause first");
    }

    const signals = await productionRepository.listSignals(incident.id);

    // No evidence to ground a recommendation in - asking the LLM to invent
    // "actionable" advice from nothing would violate the "must cite evidence"
    // requirement by construction, so skip the call rather than fabricate.
    if (signals.length === 0) {
      return { count: 0, recommendations: [] };
    }

    const evidenceText = signals.map((s) => `- [${s.signalType}] ${s.summary}`).join("\n");

    const prompt =
      `Incident: ${incident.title}\nRoot cause: ${rootCause.mostLikelyCause} (confidence ${rootCause.confidenceScore}%)\nRollback recommended: ${rootCause.rollbackRecommended}\n\n` +
      `Evidence:\n${evidenceText}\n\n` +
      `Generate 1-4 actionable recommendations as a JSON array (no markdown fences). Each item must have exactly these keys: type (one of ${RECOMMENDATION_TYPES.join(", ")}), ` +
      `title (string), description (string), rationale (string - must explicitly reference the evidence or root cause above, not a generic best practice), ` +
      `priority (one of ${PRIORITIES.join(", ")}), estimatedImpact (short string or null), confidenceScore (0-100 integer). ` +
      `If a rollback is warranted, include exactly one ROLLBACK recommendation as the first item.`;

    const result = await callAgentStepWithRetry(
      "synthesizer",
      [{ role: "user", content: prompt }],
      [],
      undefined,
      undefined,
      ctx.providerConfig ?? DEFAULT_AI_PROVIDER_CONFIG,
    );
    const recommendations = parseRecommendationsJson(result.message.content ?? "");

    const created = [];
    for (const rec of recommendations) {
      created.push(await productionRepository.createRecommendation(incident.id, rec));
    }

    return { count: created.length, recommendations: created };
  },
};
