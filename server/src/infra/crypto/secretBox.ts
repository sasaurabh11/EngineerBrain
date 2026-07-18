import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ServiceUnavailableError } from "../../common/errors/AppError.ts";
import { env } from "../../config/env.ts";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function isSecretBoxConfigured(): boolean {
  return Boolean(env.PRODUCTION_SECRET_KEY);
}

function getKey(): Buffer {
  if (!env.PRODUCTION_SECRET_KEY) {
    throw new ServiceUnavailableError("PRODUCTION_SECRET_KEY is not configured on this server - cannot store production integration credentials");
  }
  const key = Buffer.from(env.PRODUCTION_SECRET_KEY, "base64");
  if (key.length !== 32) {
    throw new ServiceUnavailableError("PRODUCTION_SECRET_KEY must decode to exactly 32 bytes (base64-encoded)");
  }
  return key;
}

/** Envelope-encrypts a credential (e.g. a Prometheus bearer token) for
 * storage in ProductionIntegration.encryptedCredential. Format:
 * base64(iv):base64(authTag):base64(ciphertext) - self-contained, no
 * separate nonce table needed. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(encrypted: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
