import { BadRequestError } from "../../../common/errors/AppError.ts";

export function requireNumberParam(params: Record<string, unknown>, key: string): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BadRequestError(`This workflow requires a numeric "${key}" parameter`);
  }
  return value;
}

export function requireStringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`This workflow requires a string "${key}" parameter`);
  }
  return value;
}
