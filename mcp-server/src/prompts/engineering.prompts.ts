import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

/** Prompts are curated entry points, not new logic - each one just tells the
 * model which of this server's existing tools to call and in what order. The
 * actual reasoning/workflows they lean on (repository_health, list_findings,
 * run_engineering_workflow, ...) already exist as tools registered elsewhere. */
export function registerEngineeringPrompts(server: McpServer): void {
  server.registerPrompt(
    "repository_review",
    {
      title: "Repository review",
      description: "A full review of a repository's architecture, health scores, and top findings.",
      argsSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    ({ repositoryId }) =>
      userMessage(
        `Review the repository with id ${repositoryId}. Call repository_summary and repository_health first for an overview, ` +
          `then list_findings filtered by category ARCHITECTURE, SECURITY, and SOLID for specific issues. ` +
          "Produce a structured review covering: overall health, architecture strengths/risks, and the top 5 most important findings with suggested fixes.",
      ),
  );

  server.registerPrompt(
    "security_audit",
    {
      title: "Security audit",
      description: "A focused security audit of a repository's findings and dependency risk.",
      argsSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    ({ repositoryId }) =>
      userMessage(
        `Perform a security audit of the repository with id ${repositoryId}. Call repository_health for the security score, ` +
          "then list_findings filtered by category SECURITY and DEPENDENCY. Summarize the most critical/high severity issues first, with concrete suggested fixes.",
      ),
  );

  server.registerPrompt(
    "performance_audit",
    {
      title: "Performance audit",
      description: "A focused performance audit of a repository's findings.",
      argsSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    ({ repositoryId }) =>
      userMessage(
        `Perform a performance audit of the repository with id ${repositoryId}. Call repository_health for the performance and complexity scores, ` +
          "then list_findings filtered by category PERFORMANCE. Summarize the most impactful issues first, with concrete suggested fixes.",
      ),
  );

  server.registerPrompt(
    "explain_topic",
    {
      title: "Explain a topic in this codebase",
      description: 'Explains how something works in a repository, e.g. "authentication", "the payment flow", "how requests are routed".',
      argsSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        topic: z.string().describe('What to explain, e.g. "authentication" or "the payment flow"'),
      },
    },
    ({ repositoryId, topic }) =>
      userMessage(
        `Explain how ${topic} works in the repository with id ${repositoryId}. Use search_repository to find the relevant code first, ` +
          "then read the most relevant files with get_file or find_symbol_source before explaining. Cite specific file paths in your answer.",
      ),
  );

  server.registerPrompt(
    "generate_onboarding_guide",
    {
      title: "Generate onboarding guide",
      description: "Generates a new-contributor onboarding guide for a repository.",
      argsSchema: { repositoryId: z.string().describe("Repository UUID") },
    },
    ({ repositoryId }) =>
      userMessage(
        `Run the "onboarding-guide" workflow (via run_engineering_workflow) against the repository with id ${repositoryId} ` +
          "and present its result as a new-contributor onboarding guide.",
      ),
  );

  server.registerPrompt(
    "review_pull_request",
    {
      title: "Review a pull request",
      description: "Runs the platform's PR review workflow (diff, CI status, dependency risk, static analysis) against a pull request.",
      argsSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        prNumber: z.string().describe("Pull request number"),
      },
    },
    ({ repositoryId, prNumber }) =>
      userMessage(
        `Run the "pr-review" workflow (via run_engineering_workflow, with prNumber: ${prNumber}) against the repository with id ${repositoryId}, ` +
          "then summarize its merge-readiness verdict and reasoning.",
      ),
  );

  server.registerPrompt(
    "triage_issue",
    {
      title: "Triage an issue",
      description: "Runs the platform's issue triage workflow (root-cause investigation) against a GitHub issue.",
      argsSchema: {
        repositoryId: z.string().describe("Repository UUID"),
        issueNumber: z.string().describe("Issue number"),
      },
    },
    ({ repositoryId, issueNumber }) =>
      userMessage(
        `Run the "issue-triage" workflow (via run_engineering_workflow, with issueNumber: ${issueNumber}) against the repository with id ${repositoryId}, ` +
          "then summarize the likely root cause, severity, and suggested next steps.",
      ),
  );
}
