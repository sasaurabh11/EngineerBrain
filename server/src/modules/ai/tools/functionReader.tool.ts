import type { AiTool, ToolContext } from "./tool.types.ts";
import { findAndReadSymbol, withRepositoryIdParam } from "./shared.ts";

interface FunctionReaderArgs {
  name: string;
  repository_id?: string;
}

export const functionReaderTool: AiTool<FunctionReaderArgs> = {
  name: "function_reader",
  description: "Reads the source of a function or method by name, including its signature, doc comment, and full body.",
  parameters: withRepositoryIdParam({ name: { type: "string", description: "Function or method name (exact or partial match)" } }, ["name"]),
  async execute(args, ctx: ToolContext) {
    return findAndReadSymbol(ctx, args, ["FUNCTION", "METHOD"]);
  },
};
