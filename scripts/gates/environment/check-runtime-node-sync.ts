#!/usr/bin/env node
// Keep the Node and pnpm versions used by local gates, CI, and shipped images in
// sync. Node 26 images install the repository's explicit pnpm version.
//
// Usage: node scripts/gates/environment/check-runtime-node-sync.ts
// Exits 0 when every declaration agrees, 1 (naming each) when they drift.
import fs from "node:fs";
import path from "node:path";

// One `source → value` pair per place a version is written down. `value` is
// undefined when the pattern did not match; an unreadable declaration is a
// failure rather than a skip, or a renamed field stops being compared silently.
interface Declaration {
  readonly source: string;
  readonly value: string | undefined;
}

interface ReadDeclaration {
  readonly source: string;
  readonly value: string;
}

interface RootManifest {
  readonly engines: { readonly node: string };
  readonly packageManager: string;
  readonly devDependencies: { readonly turbo: string };
  readonly scripts: Readonly<Record<string, string>>;
}

interface ScriptManifest {
  readonly scripts?: Readonly<Record<string, string>>;
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const read = (file: string): string =>
  fs.readFileSync(path.join(repoRoot, file), "utf8");

const ROOT_MANIFEST = "package.json";
// One declaration, because every manifest resolves `@types/node` through
// `catalog:` — pnpm enforces the agreement at install time, so this guard only
// has to check that the single catalogued major matches the runtime.
const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

const DOCKERFILES = ["Dockerfile.api", "Dockerfile.web"];
const GITLAB_CI = ".gitlab-ci.yml";
// Exact declaration counts written into .gitlab-ci.yml: a changed count is a
// drift signal that must fail, not a smaller comparison set.
const GITLAB_NODE_IMAGE_COUNT = 1;
const GITLAB_NODE_ASSERT_COUNT = 1;
const GITLAB_NODE_TOOLCHAIN_TARBALL_COUNT = 1;
const GITLAB_NODE_TOOLCHAIN_DIST_COUNT = 1;
const GITLAB_PNPM_INSTALL_COUNT = 3;
const GITLAB_PNPM_ASSERT_COUNT = 3;
const TYPESCRIPT_SCRIPT_MANIFESTS = [
  ROOT_MANIFEST,
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
  "packages/report-persistence/package.json",
  "packages/ui/package.json",
] as const;

const readRootManifest = (): RootManifest =>
  JSON.parse(read(ROOT_MANIFEST)) as RootManifest;

const majorOf = (version: string): string | undefined =>
  /(\d+)/.exec(version)?.[1];

const imageNodeVersions = (): readonly Declaration[] =>
  DOCKERFILES.flatMap((file) => {
    const matches = [
      ...read(file).matchAll(
        /^FROM node:(\d+\.\d+\.\d+)-[a-z\d.-]+@sha256:[\da-f]{64} AS ([a-z-]+)$/gmu,
      ),
    ];

    return matches.length === 0
      ? [{ source: `${file} Node image`, value: undefined }]
      : matches.map((match) => ({
          source: `${file} ${match[2] ?? "Node image"}`,
          value: match[1],
        }));
  });

const catalogTypesNodeMajor = (): Declaration => ({
  source: `${WORKSPACE_MANIFEST} catalog @types/node`,
  value: majorOf(
    /^ +"@types\/node": "([^"]+)"$/m.exec(read(WORKSPACE_MANIFEST))?.[1] ?? "",
  ),
});

// .gitlab-ci.yml writes the same versions into its job image,
// global pnpm installs, and the checksum-verified Node toolchain tarball that
// database jobs unpack. Each pattern is paired with the count the file must
// contain, so a removed or restyled declaration fails as unreadable rather
// than being skipped.
const gitlabCiPins = (
  pattern: RegExp,
  expectedCount: number,
  label: string,
): readonly Declaration[] => {
  const matches = [...read(GITLAB_CI).matchAll(pattern)];
  return Array.from({ length: expectedCount }, (_, index) => ({
    source: `${GITLAB_CI} ${label} ${index + 1}`,
    value: matches.length === expectedCount ? matches[index]?.[1] : undefined,
  }));
};

const gitlabNodeDeclarations = (): readonly Declaration[] => [
  ...gitlabCiPins(
    /^ +image: node:(\d+\.\d+\.\d+)-bookworm@sha256:[\da-f]{64}$/gmu,
    GITLAB_NODE_IMAGE_COUNT,
    "Node image",
  ),
  ...gitlabCiPins(
    /node --version\)" = "v(\d+\.\d+\.\d+)"/gu,
    GITLAB_NODE_ASSERT_COUNT,
    "node preflight",
  ),
  ...gitlabCiPins(
    /NODE_TOOLCHAIN_TARBALL: node-v(\d+\.\d+\.\d+)-linux-x64\.tar\.gz/gu,
    GITLAB_NODE_TOOLCHAIN_TARBALL_COUNT,
    "Node toolchain tarball",
  ),
  ...gitlabCiPins(
    /nodejs\.org\/dist\/v(\d+\.\d+\.\d+)\//gu,
    GITLAB_NODE_TOOLCHAIN_DIST_COUNT,
    "Node toolchain dist dir",
  ),
];

const gitlabPnpmDeclarations = (): readonly Declaration[] => [
  ...gitlabCiPins(
    /npm install --global pnpm@(\d+\.\d+\.\d+)/gu,
    GITLAB_PNPM_INSTALL_COUNT,
    "pnpm install",
  ),
  ...gitlabCiPins(
    /pnpm --version\)" = "(\d+\.\d+\.\d+)"/gu,
    GITLAB_PNPM_ASSERT_COUNT,
    "pnpm preflight",
  ),
];

// The .gitlab-ci.yml job image is the same bookworm base as Dockerfile.api's
// FROM lines, so the pinned digest — not just the tag — must agree with them.
const bookwormImageDigests = (): readonly Declaration[] => {
  const dockerfileDigests = DOCKERFILES.flatMap((file) =>
    [
      ...read(file).matchAll(
        /^FROM node:\d+\.\d+\.\d+-bookworm@sha256:([\da-f]{64})/gmu,
      ),
    ].map((match) => ({
      source: `${file} bookworm base`,
      value: match[1],
    })),
  );

  return [
    ...(dockerfileDigests.length === 0
      ? [{ source: "Dockerfiles bookworm base", value: undefined }]
      : dockerfileDigests),
    ...gitlabCiPins(
      /^ +image: node:\d+\.\d+\.\d+-bookworm@sha256:([\da-f]{64})$/gmu,
      GITLAB_NODE_IMAGE_COUNT,
      "bookworm digest",
    ),
  ];
};

const runtimeVersions = (): readonly Declaration[] => [
  { source: ".nvmrc", value: read(".nvmrc").trim() },
  ...imageNodeVersions(),
  ...gitlabNodeDeclarations(),
];

const nodeMajorDeclarations = (): readonly Declaration[] => [
  { source: ".nvmrc", value: majorOf(read(".nvmrc").trim()) },
  {
    source: "package.json engines.node",
    value: majorOf(readRootManifest().engines.node),
  },
  catalogTypesNodeMajor(),
];

const nodeEngineOk = (): boolean => {
  const engine = readRootManifest().engines.node;
  const runtimeMajor = Number.parseInt(
    majorOf(read(".nvmrc").trim()) ?? "",
    10,
  );
  const expectedEngine = Number.isNaN(runtimeMajor)
    ? undefined
    : `>=${runtimeMajor}.0.0 <${runtimeMajor + 1}.0.0`;
  if (engine !== expectedEngine) {
    console.error(
      `package.json engines.node must match the .nvmrc major: ${expectedEngine ?? "unreadable .nvmrc"}; found ${engine}`,
    );
    return false;
  }
  return true;
};

const majorless = (packageManager: string): string | undefined =>
  /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1];

// Every pnpm declaration must agree with the repository packageManager pin.
const pnpmPins = (): readonly Declaration[] => [
  {
    source: "package.json packageManager",
    value: majorless(readRootManifest().packageManager),
  },
  ...DOCKERFILES.map((file) => ({
    source: `${file} npm install -g`,
    value: /npm install -g pnpm@(\d+\.\d+\.\d+)/.exec(read(file))?.[1],
  })),
  ...gitlabPnpmDeclarations(),
];

const turboPins = (): readonly Declaration[] => [
  {
    source: "package.json devDependencies.turbo",
    value: /^(\d+\.\d+\.\d+)$/u.exec(
      readRootManifest().devDependencies.turbo,
    )?.[1],
  },
  ...DOCKERFILES.map((file) => ({
    source: `${file} npm install -g`,
    value: /npm install -g[^\n]*turbo@(\d+\.\d+\.\d+)/u.exec(read(file))?.[1],
  })),
];

const usesAmbientTsc = (command: string): boolean =>
  /(^|[\s;&|])tsc(?=\s|$)/u.test(command);

const pinnedTypescriptCliOk = (): boolean => {
  const ambientCommands = TYPESCRIPT_SCRIPT_MANIFESTS.flatMap((file) => {
    const manifest = JSON.parse(read(file)) as ScriptManifest;
    return Object.entries(manifest.scripts ?? {})
      .filter(([, command]) => usesAmbientTsc(command))
      .map(([script]) => `${file}#${script}`);
  });

  if (ambientCommands.length > 0) {
    console.error(
      `TypeScript scripts must invoke the pinned tsc6 binary, not an ambient global tsc:\n${ambientCommands
        .map((source) => `  ${source}`)
        .join("\n")}`,
    );
    return false;
  }

  console.log("TypeScript scripts use pinned tsc6");
  return true;
};

const wasRead = (entry: Declaration): entry is ReadDeclaration =>
  entry.value !== undefined;

const report = (label: string, entries: readonly Declaration[]): boolean => {
  const readable = entries.filter(wasRead);

  if (readable.length < entries.length) {
    console.error(
      `Could not read the ${label} from:\n${entries
        .filter((entry) => !wasRead(entry))
        .map((entry) => `  ${entry.source}`)
        .join("\n")}`,
    );
    return false;
  }
  const values = new Set(readable.map((entry) => entry.value));
  if (values.size > 1) {
    console.error(
      `${label} drift — these must all agree:\n${readable
        .map((entry) => `  ${entry.source}: ${entry.value}`)
        .join("\n")}`,
    );
    return false;
  }
  // Past both guards the set holds exactly one value; joining reads it out
  // without an index, which noUncheckedIndexedAccess would widen to undefined.
  console.log(`${label} in sync: ${[...values].join("")}`);
  return true;
};

const nodeVersionOk = report("Node runtime version", runtimeVersions());
const nodeImageDigestOk = report(
  "Node bookworm image digest",
  bookwormImageDigests(),
);
const nodeMajorOk = report("Node dependency major", nodeMajorDeclarations());
const nodeEngineRangeOk = nodeEngineOk();
const pnpmOk = report("pnpm version", pnpmPins());
const turboOk = report("Turbo version", turboPins());
const typescriptCliOk = pinnedTypescriptCliOk();

process.exit(
  nodeVersionOk &&
    nodeImageDigestOk &&
    nodeMajorOk &&
    nodeEngineRangeOk &&
    pnpmOk &&
    turboOk &&
    typescriptCliOk
    ? 0
    : 1,
);
