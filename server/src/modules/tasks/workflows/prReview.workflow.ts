import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { requireNumberParam } from "./params.ts";

/** Code-defined plan - the five gather steps are independent tool calls (each
 * self-sufficient given just the PR number), so the "review" agent step
 * always has PR details, diff, CI status, dependency risk, and diff-scoped
 * static analysis available before it reasons about a merge verdict. The
 * final two steps post the (validated) verdict back to GitHub as a comment
 * and a native check run - both write tools, so both pause for approval
 * before actually posting (see task.consumer.ts's approval gate). */
export function buildPrReviewPlan(params: Record<string, unknown>): PlanStepPayload[] {
  const prNumber = requireNumberParam(params, "prNumber");

  return [
    {
      id: "get_pr_details",
      type: "tool",
      name: "pr_details",
      depends_on: [],
      parallel_group: "gather",
      input_template: { pull_number: prNumber },
    },
    {
      id: "get_pr_diff",
      type: "tool",
      name: "pr_diff",
      depends_on: [],
      parallel_group: "gather",
      input_template: { pull_number: prNumber },
    },
    {
      id: "get_ci_status",
      type: "tool",
      name: "ci_status",
      depends_on: [],
      parallel_group: "gather",
      input_template: { pull_number: prNumber },
    },
    {
      id: "get_dependency_diff",
      type: "tool",
      name: "pr_dependency_diff",
      depends_on: [],
      parallel_group: "gather",
      input_template: { pull_number: prNumber },
    },
    {
      id: "get_static_analysis",
      type: "tool",
      name: "pr_static_analysis",
      depends_on: [],
      parallel_group: "gather",
      input_template: { pull_number: prNumber },
    },
    {
      id: "review_pr",
      type: "agent",
      name: "Review the PR's changes, CI status, dependency risk, and static-analysis findings; produce a safe-to-merge verdict with reasoning",
      depends_on: ["get_pr_details", "get_pr_diff", "get_ci_status", "get_dependency_diff", "get_static_analysis"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "validate_review",
      type: "validation",
      name: "Validate the PR review is grounded in the gathered diff, CI, dependency, and static-analysis data",
      depends_on: ["review_pr"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "post_review_comment",
      type: "tool",
      name: "create_github_comment",
      depends_on: ["validate_review"],
      parallel_group: "publish",
      input_template: { issue_number: prNumber, body: { $step: "validate_review" } },
    },
    {
      id: "post_review_check",
      type: "tool",
      name: "post_check_run",
      depends_on: ["validate_review"],
      parallel_group: "publish",
      input_template: {
        head_sha: { $step: "get_pr_details", $field: "headSha" },
        title: "AI PR Review",
        summary: { $step: "validate_review" },
        // Informational rather than a hard pass/fail gate - the review_pr
        // step produces prose, not yet a structured mergeable verdict to
        // derive a real success/failure conclusion from.
        conclusion: "neutral",
      },
    },
  ];
}
