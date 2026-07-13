import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { requireNumberParam } from "./params.ts";

/** Code-defined plan - the "analyze_issue" agent step has its own internal
 * tool-calling loop (see task.consumer.ts's executeAgentStep), so it can
 * dynamically search for related code once it has read the issue itself,
 * rather than needing a fixed semantic_search step with a query nobody knows
 * in advance. */
export function buildIssueTriagePlan(params: Record<string, unknown>): PlanStepPayload[] {
  const issueNumber = requireNumberParam(params, "issueNumber");

  return [
    {
      id: "get_issue_details",
      type: "tool",
      name: "issue_details",
      depends_on: [],
      parallel_group: null,
      input_template: { issue_number: issueNumber },
    },
    {
      id: "analyze_issue",
      type: "agent",
      name: "Investigate the issue's likely root cause and affected code, then triage it (severity, priority, suggested next steps)",
      depends_on: ["get_issue_details"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "validate_triage",
      type: "validation",
      name: "Validate the triage is grounded in the issue and any code gathered",
      depends_on: ["analyze_issue"],
      parallel_group: null,
      input_template: {},
    },
  ];
}
