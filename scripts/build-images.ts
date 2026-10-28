import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface BuildOptions {
  readonly push: boolean;
  readonly targets?: readonly string[] | undefined;
  readonly registry?: string | undefined;
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

function parseCliArgs(args: readonly string[]): BuildOptions {
  let push = true;
  let registry: string | undefined;
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
      case "--registry":
        registry = parseOptionValue(args, index++, argument);
        break;
      case "--target":
      case "--only": {
        const value = parseOptionValue(args, index++, argument);
        targets.push(...value.split(",").map((name) => name.trim()));
        break;
      }
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { push, targets: targets.length > 0 ? targets : undefined, registry };
}

function printHelpAndExit(): never {
  console.log(`
Usage: pnpm images:build [options]

Builds api, migrate, web, backup images via docker buildx and pushes to registry.

Options:
  --no-push            Build images locally without pushing to remote registry
  --push               Push images after build (default: true)
  --registry <url>     Override target registry prefix
  --target, --only     Comma-separated list of targets to build (api, migrate, web, backup)
  -h, --help           Show this help message
`);
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
  const isMatch = headSha === mainSha;
  let isRelated = false;
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

  if (!isMatch && !isRelated) {
    throw new Error(
      `HEAD (${headSha}) is not on ${GITLAB_MAIN} branch lineage (${mainSha}). Only commits based on ${GITLAB_MAIN} can be built and tagged for deployment.`,
    );
  }
  return headSha;
}

function checkEnvironmentPreconditions(): void {
  const requiredEnvVars = [
    "WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
    "WR_NEXT_PUBLIC_WEB_VITALS",
    "WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED",
    "WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES",
  ] as const;

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `Missing required environment variable: ${envVar}. Refusing to build web image.`,
      );
    }
  }
}

function checkDockerAuth(registryHost: string): void {
  const homeDirectory = process.env.HOME ?? "";
  const dockerConfigPath = process.env.DOCKER_CONFIG
    ? resolve(process.env.DOCKER_CONFIG, "config.json")
    : resolve(homeDirectory, ".docker", "config.json");

  if (!existsSync(dockerConfigPath)) {
    throw new Error(
      `Docker config not found at ${dockerConfigPath}. Please run 'docker login ${registryHost}' first.`,
    );
  }

  try {
    const config = JSON.parse(readFileSync(dockerConfigPath, "utf8")) as {
      readonly auths?: Readonly<Record<string, unknown>>;
    };
    const hasAuth = Object.keys(config.auths ?? {}).some(
      (host) => host === registryHost || host.startsWith(`${registryHost}/`),
    );
    if (!hasAuth) {
      throw new Error(
        `No authentication found for registry host '${registryHost}' in ${dockerConfigPath}. Please run 'docker login ${registryHost}' first.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("No authentication")) {
      throw error;
    }
    throw new Error(`Failed to read Docker config at ${dockerConfigPath}`);
  }
}

function checkPreconditions(push: boolean): {
  readonly commitSha: string;
  readonly registry: string;
} {
  const commitSha = checkGitPreconditions();
  checkEnvironmentPreconditions();

  const registry =
    process.env.IMAGE_REGISTRY ||
    process.env.CI_REGISTRY_IMAGE ||
    "gitlab.example.org:5005/acme/weeklyreport";

  if (push) {
    const registryHost = registry.split("/")[0] ?? "";
    checkDockerAuth(registryHost);
  }

  return { commitSha, registry };
}

interface ImageTarget {
  readonly name: string;
  readonly context: string;
  readonly dockerfile: string;
  readonly target?: string | undefined;
  readonly buildArgs: readonly string[];
}

function getImageTargets(commitSha: string): readonly ImageTarget[] {
  return [
    {
      name: "api",
      context: ".",
      dockerfile: "Dockerfile.api",
      buildArgs: [`BUILD_VERSION=${commitSha}`],
    },
    {
      name: "migrate",
      context: ".",
      dockerfile: "Dockerfile.api",
      target: "migrator",
      buildArgs: [`BUILD_VERSION=${commitSha}`],
    },
    {
      name: "web",
      context: ".",
      dockerfile: "Dockerfile.web",
      buildArgs: [
        "API_URL=http://api:3001",
        "NEXT_PUBLIC_AUTH_STUB=false",
        "NEXT_PUBLIC_DEV_ROLE_SWITCHER=false",
        `NEXT_PUBLIC_SENTRY_DSN=${process.env.NEXT_PUBLIC_SENTRY_DSN || ""}`,
        `NEXT_PUBLIC_APP_VERSION=${commitSha}`,
        `NEXT_PUBLIC_CLIENT_LOG_FORWARDING=${process.env.WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING ?? ""}`,
        `NEXT_PUBLIC_WEB_VITALS=${process.env.WR_NEXT_PUBLIC_WEB_VITALS ?? ""}`,
        `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=${process.env.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED ?? ""}`,
        `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=${process.env.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES ?? ""}`,
      ],
    },
    {
      name: "backup",
      context: "deploy/postgres",
      dockerfile: "deploy/postgres/Dockerfile.backup",
      buildArgs: [`BUILD_VERSION=${commitSha}`],
    },
  ];
}

function buildTarget(
  target: ImageTarget,
  registry: string,
  commitSha: string,
  push: boolean,
): void {
  const fullImageTag = `${registry}/${target.name}:${commitSha}`;
  console.log(`\n=== Building ${target.name} -> ${fullImageTag} ===`);

  const args = ["buildx", "build", "-f", target.dockerfile, "-t", fullImageTag];
  if (target.target) args.push("--target", target.target);
  for (const buildArg of target.buildArgs) {
    args.push("--build-arg", buildArg);
  }
  args.push(push ? "--push" : "--load");
  args.push(target.context);

  console.log(`Running: ${DOCKER_BIN} ${args.join(" ")}`);
  try {
    execFileSync(DOCKER_BIN, args, { stdio: "inherit" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `docker buildx build failed for ${target.name}: ${message}`,
    );
  }

  console.log(`Successfully built ${fullImageTag}`);
}

export function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const { commitSha, registry } = checkPreconditions(options.push);
  const targetRegistry = options.registry || registry;

  console.log(`Target registry: ${targetRegistry}`);
  console.log(`Commit SHA:      ${commitSha}`);
  console.log(`Push enabled:    ${String(options.push)}`);

  const allTargets = getImageTargets(commitSha);
  const targetsToBuild = options.targets
    ? allTargets.filter((candidate) =>
        options.targets?.includes(candidate.name),
      )
    : allTargets;

  if (targetsToBuild.length === 0) {
    throw new Error(
      `No valid targets selected to build. Available: ${allTargets.map((candidate) => candidate.name).join(", ")}`,
    );
  }

  for (const target of targetsToBuild) {
    buildTarget(target, targetRegistry, commitSha, options.push);
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
