import { App } from "octokit";
import { ServiceUnavailableError } from "../../common/errors/AppError.ts";
import { env } from "../../config/env.ts";

let app: App | null = null;

export function isGitHubAppConfigured(): boolean {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY_BASE64 && env.GITHUB_WEBHOOK_SECRET);
}

export function getGitHubApp(): App {
  if (!isGitHubAppConfigured()) {
    throw new ServiceUnavailableError("GitHub integration is not configured on this server");
  }

  if (!app) {
    const privateKey = Buffer.from(env.GITHUB_APP_PRIVATE_KEY_BASE64!, "base64").toString("utf-8");
    app = new App({
      appId: env.GITHUB_APP_ID!,
      privateKey,
      webhooks: { secret: env.GITHUB_WEBHOOK_SECRET! },
    });
  }

  return app;
}

export async function getInstallationOctokit(githubInstallationId: number) {
  const app = getGitHubApp();
  return app.getInstallationOctokit(githubInstallationId);
}
