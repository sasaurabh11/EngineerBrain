import pino from "pino";
import { env } from "../config/env.ts";

/**
 * The stdio transport uses stdout as the JSON-RPC wire - any stray log line
 * written there corrupts the protocol stream. Every log destination in this
 * process must be stderr (fd 2), regardless of which transport is active.
 */
export const logger = pino({ level: env.NODE_ENV === "production" ? "info" : "debug" }, pino.destination(2));
