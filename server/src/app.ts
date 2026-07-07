import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.ts";
import { logger } from "./config/logger.ts";
import { errorHandler } from "./middleware/error.middleware.ts";
import { notFoundHandler } from "./middleware/notFound.middleware.ts";
import { router } from "./routes/index.ts";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(clerkMiddleware());

app.use("/api/v1", router);

app.use(notFoundHandler);
app.use(errorHandler);
