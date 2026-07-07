import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../common/errors/AppError.ts";
import { sendError } from "../common/response/formatResponse.ts";
import { logger } from "../config/logger.ts";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.code);
  }

  if (err instanceof ZodError) {
    return sendError(res, 400, "Validation failed", "VALIDATION_ERROR");
  }

  logger.error({ err }, "Unhandled error");
  return sendError(res, 500, "Internal server error", "INTERNAL_ERROR");
};
