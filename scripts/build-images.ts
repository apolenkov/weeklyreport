import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertPlatformInIndex,
  buildxArgs,
  getImageTargets,
  type ImageTarget,
  parseEnvFile,
  readReleaseConfig,
  RELEASE_ENV_FILE,
  type ReleaseConfig,
} from "./build-images-plan.ts";

export interface BuildOptions {
  readonly push: boolean;
  readonly targets?: readonly string[] | undefined;
}

function parseOptionValue(
  args: readonly string[],
  index: number,
  option: string,
): string {
  const value = args[index];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

export function parseCliArgs(args: readonly string[]): BuildOptions {
  let push = true;
  const targets: string[] = [];

  let index = 0;
  while (index < args.length) {
    const argument = args[index++];
    if (argument === undefined) break;

    switch (argument) {
      case "--no-push":
        push = false;
        break;
      case "--push":
        push = true;
        break;
      case "-h":
      case "--help":
        printHelpAndExit();
        break;
      case "--only":
      case "--target": {
        const value = parseOptionValue(args, index++, argument);
        targets.push(...value.split(",").map((name) => name.trim()));
        break;
      }
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { push, targets: targets.length > 0 ? targets : undefined };
}

function printHelpAndExit(): never {
  console.log(`Usage: pnpm images:build [options]
Registry and platform come only from deploy/images/release.env.
Options:
  --no-push            Build images locally without pushing to remote registry
  --push               Push images after build (default: true)
  --target, --only     Comma-separated list of targets to build (api, migrate, web, backup)
  -h, --help           Show this help message`);
  process.exit(0);
}

function findCommand(name: string): string {
  try {
    return execFileSync("/usr/bin/which", [name], { encoding: "utf8" }).trim();
  } catch {
    return name;
  }
}

const GIT_BIN = findCommand("git");
const DOCKER_BIN = findCommand("docker");
const GITLAB_MAIN = "gitlab/main";
const WEB_ENV_FILE = "deploy/images/web-public.env";

function execGit(args: readonly string[]): string {
  try {
    return execFileSync(GIT_BIN, args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

function checkGitPreconditions(): string {
  const status = execGit(["status", "--porcelain"]);
  if (status.length > 0) {
    throw new Error(
      `Working tree is dirty. Refusing to build release images.\n${status}`,
    );
  }

  const headSha = execGit(["rev-parse", "HEAD"]);
  const mainSha = execGit(["rev-parse", GITLAB_MAIN]);
  let isRelated = headSha === mainSha;
  if (!isRelated) {
    try {
      execGit(["merge-base", "--is-ancestor", "HEAD", GITLAB_MAIN]);
      isRelated = true;
    } catch {
      try {
        execGit(["merge-base", "--is-ancestor", GITLAB_MAIN, "HEAD"]);
        isRelated = true;
      } catch {
        // not related
      }
    }
  }

  if (!isRelated) {
    throw new Error(
      `HEAD (${headSha}) is not on ${GITLAB_MAIN} lineage (${mainSha}).`,
    );
  }
  return headSha;
}

function loadReleaseConfig(): ReleaseConfig {
  const envPath = resolve(RELEASE_ENV_FILE);
  if (!existsSync(envPath)) {
    throw new Error(
      `Missing release config: ${RELEASE_ENV_FILE}. Refusing to build without a registry and platform.`,
    );
  }
  return readReleaseConfig(readFileSync(envPath, "utf8"));
}

function loadWebPublicEnv(): Record<string, string> {
  const envPath = resolve(WEB_ENV_FILE);
  if (!existsSync(envPath)) {
    throw new Error(`Missing web build config file: ${WEB_ENV_FILE}.`);
  }
  const parsed = parseEnvFile(readFileSync(envPath, "utf8"));

  const requiredKeys = [
    "WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
    "WR_NEXT_PUBLIC_WEB_VITALS",
    "WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED",
    "WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES",
  ];

  for (const key of requiredKeys) {
    const resolved = process.env[key] || parsed[key];
    if (!resolved) {
      throw new Error(
        `Missing web config: ${key} (not in env or ${WEB_ENV_FILE}).`,
      );
    }
    parsed[key] = resolved;
  }
  return parsed;
}

function checkDockerAuth(registryHost: string): void {
  const homeDir = process.env.HOME ?? "";
  const configPath = process.env.DOCKER_CONFIG
    ? resolve(process.env.DOCKER_CONFIG, "config.json")
    : resolve(homeDir, ".docker", "config.json");

  if (!existsSync(configPath)) {
    throw new Error(`Docker config not found at ${configPath}.`);
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      readonly auths?: Readonly<Record<string, unknown>>;
    };
    const hasAuth = Object.keys(config.auths ?? {}).some(
      (host) => host === registryHost || host.startsWith(`${registryHost}/`),
    );
    if (!hasAuth) {
      throw new Error(`No auth for '${registryHost}' in ${configPath}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("No auth"))
      throw error;
    throw new Error(`Failed to read Docker config at ${configPath}`);
  }
}

function buildTarget(
  target: ImageTarget,
  release: ReleaseConfig,
  commitSha: string,
  push: boolean,
): void {
  const fullImageTag = `${release.registry}/${target.name}:${commitSha}`;
  console.log(`\n=== Building ${target.name} -> ${fullImageTag} ===`);

  const args = buildxArgs(target, fullImageTag, release.platform, push);
  console.log(`Running: ${DOCKER_BIN} ${args.join(" ")}`);
  try {
    execFileSync(DOCKER_BIN, args, { stdio: "inherit" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`docker buildx build failed for ${target.name}: ${msg}`);
  }

  if (push) {
    const index = execFileSync(
      DOCKER_BIN,
      ["buildx", "imagetools", "inspect", "--raw", fullImageTag],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assertPlatformInIndex(index, fullImageTag, release.platform);
  }
  console.log(`Successfully built ${fullImageTag}`);
}

export function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const release = loadReleaseConfig();
  const commitSha = checkGitPreconditions();

  if (options.push) {
    checkDockerAuth(release.registry.split("/")[0] ?? "");
  }

  const needsWeb = !options.targets || options.targets.includes("web");
  const webEnv = needsWeb ? loadWebPublicEnv() : {};

  const allTargets = getImageTargets(commitSha, webEnv);
  const targetsToBuild = options.targets
    ? allTargets.filter((candidate) =>
        options.targets?.includes(candidate.name),
      )
    : allTargets;

  if (targetsToBuild.length === 0) {
    throw new Error(`No valid targets selected to build.`);
  }

  for (const target of targetsToBuild) {
    buildTarget(target, release, commitSha, options.push);
  }
  console.log("\nAll requested images built successfully.");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  try {
    main();
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
