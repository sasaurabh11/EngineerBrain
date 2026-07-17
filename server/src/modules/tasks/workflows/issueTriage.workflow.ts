import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { requireNumberParam } from "./params.ts";

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
      name:
        "Investigate the issue's likely root cause and affected code, then triage it (severity, priority, suggested next steps). " +
        "Where the fix is clear enough to show, include a concrete suggested-fix code snippet (in the repository's own language, referencing the " +
        "actual file/function involved) as an illustrative example - not a promise that it was applied, just a starting point for whoever fixes it.",
      depends_on: ["get_issue_details"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "validate_triage",
      type: "validation",
      name: "Validate the triage is grounded in the issue and any code gathered, and that any suggested-fix code snippet is plausible given the actual code read",
      depends_on: ["analyze_issue"],
      parallel_group: null,
      input_template: {},
    },
  ];
}
