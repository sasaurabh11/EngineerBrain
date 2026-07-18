import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLIENT_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  RABBITMQ_URL: z.string().min(1).default("amqp://engineerbrain:engineerbrain@localhost:5672"),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY_BASE64: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  AI_SERVICE_URL: z.string().min(1).default("http://localhost:8000"),
  AI_SERVICE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().min(1).default("gemini-flash-latest"),
  // 32-byte key, base64-encoded (e.g. `openssl rand -base64 32`) - encrypts
  // ProductionIntegration credentials at rest. See infra/crypto/secretBox.ts.
  PRODUCTION_SECRET_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
