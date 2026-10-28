// Pure planning for pnpm images:build: release coordinates, image targets,
// buildx arguments and the post-push platform check. No git, Docker or
// registry access happens here.

export const RELEASE_ENV_FILE = "deploy/images/release.env";

export interface ReleaseConfig {
  readonly registry: string;
  readonly platform: string;
}

export interface ImageTarget {
  readonly name: string;
  readonly context: string;
  readonly dockerfile: string;
  readonly target?: string | undefined;
  readonly buildArgs: readonly string[];
}

export function parseEnvFile(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const splitIndex = trimmed.indexOf("=");
    if (splitIndex > 0) {
      parsed[trimmed.slice(0, splitIndex).trim()] = trimmed
        .slice(splitIndex + 1)
        .trim();
    }
  }
  return parsed;
}

export function readReleaseConfig(text: string): ReleaseConfig {
  const values = parseEnvFile(text);
  for (const key of ["IMAGE_REGISTRY", "IMAGE_PLATFORM"]) {
    if (!values[key]) {
      throw new Error(`Missing ${key} in ${RELEASE_ENV_FILE}.`);
    }
  }
  const platform = values.IMAGE_PLATFORM ?? "";
  if (!/^[a-z0-9]+\/[a-z0-9_]+$/u.test(platform)) {
    throw new Error(
      `IMAGE_PLATFORM must look like os/architecture in ${RELEASE_ENV_FILE}, got '${platform}'.`,
    );
  }
  return { registry: values.IMAGE_REGISTRY ?? "", platform };
}

export function getImageTargets(
  commitSha: string,
  webEnv: Record<string, string>,
): readonly ImageTarget[] {
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
        `NEXT_PUBLIC_CLIENT_LOG_FORWARDING=${webEnv.WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING ?? ""}`,
        `NEXT_PUBLIC_WEB_VITALS=${webEnv.WR_NEXT_PUBLIC_WEB_VITALS ?? ""}`,
        `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=${webEnv.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED ?? ""}`,
        `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=${webEnv.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES ?? ""}`,
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

export function buildxArgs(
  target: ImageTarget,
  fullImageTag: string,
  platform: string,
  push: boolean,
): string[] {
  const args = [
    "buildx",
    "build",
    "-f",
    target.dockerfile,
    "-t",
    fullImageTag,
    "--platform",
    platform,
  ];
  if (target.target) args.push("--target", target.target);
  for (const buildArg of target.buildArgs) args.push("--build-arg", buildArg);
  args.push(push ? "--push" : "--load");
  args.push(target.context);
  return args;
}

// The registry index of a pushed image must list the release platform. buildx
// also adds an attestation entry (unknown/unknown), which does not count.
export function assertPlatformInIndex(
  rawManifest: string,
  image: string,
  platform: string,
): void {
  const [os, architecture] = platform.split("/");
  let index: {
    readonly manifests?:
      | readonly { readonly platform?: Readonly<Record<string, string>> }[]
      | undefined;
  };
  try {
    index = JSON.parse(rawManifest) as typeof index;
  } catch {
    throw new Error(`Registry returned no readable manifest for ${image}.`);
  }
  const listed = (index.manifests ?? []).some(
    (manifest) =>
      manifest.platform?.os === os &&
      manifest.platform?.architecture === architecture,
  );
  if (!listed) {
    throw new Error(
      `${image} does not list platform ${platform} in its registry index.`,
    );
  }
}
