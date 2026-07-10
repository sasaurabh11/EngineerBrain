import { apiExplorerTool } from "./apiExplorer.tool.ts";
import { classReaderTool } from "./classReader.tool.ts";
import { dependencyGraphTool } from "./dependencyGraph.tool.ts";
import { documentationSearchTool } from "./documentationSearch.tool.ts";
import { explainFindingTool } from "./explainFinding.tool.ts";
import { explainPatternTool } from "./explainPattern.tool.ts";
import { explainScoreTool } from "./explainScore.tool.ts";
import { fileReaderTool } from "./fileReader.tool.ts";
import { frameworkDetectionTool } from "./frameworkDetection.tool.ts";
import { functionReaderTool } from "./functionReader.tool.ts";
import { healthReportTool } from "./healthReport.tool.ts";
import { repositoryStructureTool } from "./repositoryStructure.tool.ts";
import { semanticSearchTool } from "./semanticSearch.tool.ts";
import type { AiTool } from "./tool.types.ts";

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
];

const toolsByName = new Map(TOOLS.map((tool) => [tool.name, tool]));

export const toolRegistry = {
  all(): AiTool<any>[] {
    return TOOLS;
  },

  get(name: string): AiTool<any> | undefined {
    return toolsByName.get(name);
  },

  schemas() {
    return TOOLS.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
  },
};
