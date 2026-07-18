import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isSecretBoxConfigured } from "./secretBox.ts";

describe("secretBox", () => {
  it("is configured from PRODUCTION_SECRET_KEY in the test environment", () => {
    expect(isSecretBoxConfigured()).toBe(true);
  });

  it("round-trips a plaintext secret through encrypt/decrypt", () => {
    const plaintext = "sk-prometheus-bearer-token-example";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) even for the same plaintext", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });

  it("throws on a tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptSecret("tamper-test");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, `${ciphertext!.slice(0, -4)}abcd`].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws on a malformed encrypted string", () => {
    expect(() => decryptSecret("not-a-valid-format")).toThrow("Malformed encrypted secret");
  });
});
