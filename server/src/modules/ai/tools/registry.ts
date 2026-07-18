import { analyzeRootCauseTool } from "./analyzeRootCause.tool.ts";
import { apiExplorerTool } from "./apiExplorer.tool.ts";
import { blastRadiusTool } from "./blastRadius.tool.ts";
import { ciStatusTool } from "./ciStatus.tool.ts";
import { classReaderTool } from "./classReader.tool.ts";
import { correlateIncidentEvidenceTool } from "./correlateIncidentEvidence.tool.ts";
import { createGithubCommentTool } from "./createGithubComment.tool.ts";
import { declareIncidentTool } from "./declareIncident.tool.ts";
import { dependencyGraphTool } from "./dependencyGraph.tool.ts";
import { deploymentHistoryTool } from "./deploymentHistory.tool.ts";
import { documentationSearchTool } from "./documentationSearch.tool.ts";
import { explainFindingTool } from "./explainFinding.tool.ts";
import { explainPatternTool } from "./explainPattern.tool.ts";
import { explainScoreTool } from "./explainScore.tool.ts";
import { fileReaderTool } from "./fileReader.tool.ts";
import { frameworkDetectionTool } from "./frameworkDetection.tool.ts";
import { functionReaderTool } from "./functionReader.tool.ts";
import { generatePostmortemTool } from "./generatePostmortem.tool.ts";
import { generateRecommendationsTool } from "./generateRecommendations.tool.ts";
import { healthReportTool } from "./healthReport.tool.ts";
import { incidentDetailsTool } from "./incidentDetails.tool.ts";
import { issueDetailsTool } from "./issueDetails.tool.ts";
import { postCheckRunTool } from "./postCheckRun.tool.ts";
import { prDependencyDiffTool } from "./prDependencyDiff.tool.ts";
import { prDependencyImpactTool } from "./prDependencyImpact.tool.ts";
import { prDetailsTool } from "./prDetails.tool.ts";
import { prDiffTool } from "./prDiff.tool.ts";
import { prStaticAnalysisTool } from "./prStaticAnalysis.tool.ts";
import { productionIncidentsTool } from "./productionIncidents.tool.ts";
import { repositoryStructureTool } from "./repositoryStructure.tool.ts";
import { rollbackRecommendationTool } from "./rollbackRecommendation.tool.ts";
import { semanticSearchTool } from "./semanticSearch.tool.ts";
import { serviceHealthTool } from "./serviceHealth.tool.ts";
import type { AiTool } from "./tool.types.ts";
import { triggerReanalysisTool } from "./triggerReanalysis.tool.ts";
import { triggerReindexTool } from "./triggerReindex.tool.ts";

const TOOLS: AiTool<any>[] = [
  semanticSearchTool,
  documentationSearchTool,
  repositoryStructureTool,
  dependencyGraphTool,
  frameworkDetectionTool,
  fileReaderTool,
  classReaderTool,
  functionReaderTool,
  apiExplorerTool,
  healthReportTool,
  explainFindingTool,
  explainPatternTool,
  explainScoreTool,
  triggerReanalysisTool,
  triggerReindexTool,
  createGithubCommentTool,
  prDetailsTool,
  prDiffTool,
  ciStatusTool,
  prDependencyDiffTool,
  prDependencyImpactTool,
  issueDetailsTool,
  prStaticAnalysisTool,
  postCheckRunTool,
  analyzeRootCauseTool,
  generateRecommendationsTool,
  declareIncidentTool,
  productionIncidentsTool,
  incidentDetailsTool,
  deploymentHistoryTool,
  serviceHealthTool,
  blastRadiusTool,
  correlateIncidentEvidenceTool,
  rollbackRecommendationTool,
  generatePostmortemTool,
];

const toolsByName = new Map(TOOLS.map((tool) => [tool.name, tool]));

export const toolRegistry = {
  all(): AiTool<any>[] {
    return TOOLS;
  },

  get(name: string): AiTool<any> | undefined {
    return toolsByName.get(name);
  },

  isWriteTool(name: string): boolean {
    return toolsByName.get(name)?.permission === "write";
  },

  schemas() {
    return TOOLS.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
  },

  // Excludes write tools - the conversational chat loop never gets access to
  // mutating tools, only the Task Execution Engine does (with its approval gate).
  readOnlySchemas() {
    return TOOLS.filter((tool) => tool.permission !== "write").map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  },
};
