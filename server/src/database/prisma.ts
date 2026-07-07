import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.ts";

export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
