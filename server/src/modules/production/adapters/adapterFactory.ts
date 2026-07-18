import { BadRequestError } from "../../../common/errors/AppError.ts";
import { decryptSecret } from "../../../infra/crypto/secretBox.ts";
import type { MetricsAdapter } from "./adapter.types.ts";
import { PrometheusMetricsAdapter } from "./prometheusAdapter.ts";

export interface IntegrationRecord {
  provider: string;
  config: unknown;
  encryptedCredential: string | null;
}

/** Resolves the concrete adapter for a stored ProductionIntegration. GitHub
 * Actions deployments don't go through here - they reuse the org's existing
 * GitHubInstallation/Octokit client directly (see deploymentSync.ts), since
 * that's a separate, already-authenticated integration, not a
 * ProductionIntegration credential. */
export function resolveMetricsAdapter(integration: IntegrationRecord): MetricsAdapter {
  const config = (integration.config ?? {}) as Record<string, unknown>;

  switch (integration.provider) {
    case "PROMETHEUS": {
      const baseUrl = typeof config.baseUrl === "string" ? config.baseUrl : undefined;
      if (!baseUrl) {
        throw new BadRequestError("Prometheus integration is missing a baseUrl in its config");
      }
      const bearerToken = integration.encryptedCredential ? decryptSecret(integration.encryptedCredential) : undefined;
      return new PrometheusMetricsAdapter(baseUrl, bearerToken);
    }
    default:
      throw new BadRequestError(`No metrics adapter available for provider "${integration.provider}"`);
  }
}
