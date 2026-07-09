import type { AiTool, ToolContext } from "./tool.types.ts";
import { findAndReadSymbol, withRepositoryIdParam } from "./shared.ts";

interface ClassReaderArgs {
  name: string;
  repository_id?: string;
}

export const classReaderTool: AiTool<ClassReaderArgs> = {
  name: "class_reader",
  description: "Reads the source of a class or interface by name, including its signature, doc comment, and full body.",
  parameters: withRepositoryIdParam({ name: { type: "string", description: "Class or interface name (exact or partial match)" } }, ["name"]),
  async execute(args, ctx: ToolContext) {
    return findAndReadSymbol(ctx, args, ["CLASS", "INTERFACE"]);
  },
};
