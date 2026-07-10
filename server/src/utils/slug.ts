import { randomBytes } from "node:crypto";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function randomSuffix(): string {
  return randomBytes(3).toString("hex");
}

export function generateUniqueSlug(name: string): string {
  const base = slugify(name) || "organization";
  return `${base}-${randomSuffix()}`;
}
