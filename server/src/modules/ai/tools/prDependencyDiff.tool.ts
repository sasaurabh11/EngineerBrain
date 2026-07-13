import type { AiTool, ToolContext } from "./tool.types.ts";
import { resolveRepositoryWithOctokit, withRepositoryIdParam } from "./shared.ts";

const OSV_API_URL = "https://api.osv.dev/v1/query";
const MANIFEST_FILENAMES = new Set(["package.json", "requirements.txt", "pom.xml"]);

interface Package {
  name: string;
  version: string;
  ecosystem: string;
}

function parseNpmManifest(content: string): Package[] {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }
  const packages: Package[] = [];
  for (const section of ["dependencies", "devDependencies"]) {
    const deps = data[section] as Record<string, string> | undefined;
    for (const [name, rawVersion] of Object.entries(deps ?? {})) {
      const version = rawVersion.replace(/^[\^~>=<\s]+/, "");
      if (version && /^\d/.test(version)) {
        packages.push({ name, version, ecosystem: "npm" });
      }
    }
  }
  return packages;
}

function parsePypiManifest(content: string): Package[] {
  const packages: Package[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_.-]+)\s*==\s*([A-Za-z0-9_.-]+)/.exec(line);
    if (match) {
      packages.push({ name: match[1]!, version: match[2]!, ecosystem: "PyPI" });
    }
  }
  return packages;
}

function parseMavenManifest(content: string): Package[] {
  const packages: Package[] = [];
  const dependencyBlocks = content.match(/<dependency>[\s\S]*?<\/dependency>/g) ?? [];
  for (const block of dependencyBlocks) {
    const groupId = /<groupId>([^<]+)<\/groupId>/.exec(block)?.[1];
    const artifactId = /<artifactId>([^<]+)<\/artifactId>/.exec(block)?.[1];
    const version = /<version>([^<]+)<\/version>/.exec(block)?.[1];
    if (groupId && artifactId && version && !version.startsWith("$")) {
      packages.push({ name: `${groupId}:${artifactId}`, version, ecosystem: "Maven" });
    }
  }
  return packages;
}

const MANIFEST_PARSERS: Record<string, (content: string) => Package[]> = {
  "package.json": parseNpmManifest,
  "requirements.txt": parsePypiManifest,
  "pom.xml": parseMavenManifest,
};

async function fetchFileAtRef(
  octokit: Awaited<ReturnType<typeof resolveRepositoryWithOctokit>>["octokit"],
  owner: string,
  repoName: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo: repoName, path, ref });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: { type: string; score: string }[];
}

async function queryOsv(pkg: Package): Promise<OsvVuln[]> {
  try {
    const response = await fetch(OSV_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name: pkg.name, ecosystem: pkg.ecosystem }, version: pkg.version }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { vulns?: OsvVuln[] };
    return data.vulns ?? [];
  } catch {
    return [];
  }
}

interface PrDependencyDiffArgs {
  repository_id?: string;
  pull_number: number;
}

export const prDependencyDiffTool: AiTool<PrDependencyDiffArgs> = {
  name: "pr_dependency_diff",
  description:
    "Compares dependency manifests (package.json, requirements.txt, pom.xml) changed by a pull request against the base branch, " +
    "and checks any new or version-bumped dependency against the OSV.dev vulnerability database.",
  parameters: withRepositoryIdParam(
    { pull_number: { type: "number", description: "Pull request number" } },
    ["pull_number"],
  ),
  async execute(args, ctx: ToolContext) {
    const { repo, octokit } = await resolveRepositoryWithOctokit(ctx, args);

    const { data: pr } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: repo.ownerLogin,
      repo: repo.name,
      pull_number: args.pull_number,
    });

    const changedFiles = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      owner: repo.ownerLogin,
      repo: repo.name,
      pull_number: args.pull_number,
      per_page: 100,
    });

    const manifestFiles = changedFiles.filter((f) => MANIFEST_FILENAMES.has(f.filename.split("/").pop() ?? ""));
    if (manifestFiles.length === 0) {
      return { repositoryId: repo.id, pullNumber: args.pull_number, manifestsChanged: [], newOrChangedDependencies: [] };
    }

    const newOrChangedDependencies: (Package & { previousVersion: string | null; vulnerabilities: OsvVuln[] })[] = [];

    for (const file of manifestFiles) {
      const filename = file.filename.split("/").pop()!;
      const parser = MANIFEST_PARSERS[filename];
      if (!parser) continue;

      const [baseContent, headContent] = await Promise.all([
        fetchFileAtRef(octokit, repo.ownerLogin, repo.name, file.filename, pr.base.sha),
        fetchFileAtRef(octokit, repo.ownerLogin, repo.name, file.filename, pr.head.sha),
      ]);

      const basePackages = new Map((baseContent ? parser(baseContent) : []).map((p) => [p.name, p.version]));
      const headPackages = headContent ? parser(headContent) : [];

      for (const pkg of headPackages) {
        const previousVersion = basePackages.get(pkg.name) ?? null;
        if (previousVersion === pkg.version) continue; // unchanged

        const vulnerabilities = await queryOsv(pkg);
        newOrChangedDependencies.push({ ...pkg, previousVersion, vulnerabilities });
      }
    }

    return {
      repositoryId: repo.id,
      pullNumber: args.pull_number,
      manifestsChanged: manifestFiles.map((f) => f.filename),
      newOrChangedDependencies: newOrChangedDependencies.map((d) => ({
        name: d.name,
        ecosystem: d.ecosystem,
        previousVersion: d.previousVersion,
        newVersion: d.version,
        vulnerabilityCount: d.vulnerabilities.length,
        vulnerabilities: d.vulnerabilities.map((v) => ({ id: v.id, summary: v.summary })),
      })),
    };
  },
};
