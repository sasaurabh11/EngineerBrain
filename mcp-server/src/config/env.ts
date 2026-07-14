import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ENGINEERBRAIN_API_URL: z.string().min(1).default("http://localhost:4000/api/v1"),
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  ENGINEERBRAIN_API_KEY: z.string().optional(),
  MCP_HTTP_PORT: z.coerce.number().default(3800),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
