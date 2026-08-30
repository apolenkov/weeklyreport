#!/usr/bin/env node
// Drift guard: the Node major the code is typed, linted and tested against must
// be the one the shipped images actually execute. Before this guard the repo ran
// three at once — .nvmrc 26, web image 25, api image 24 (inherited unnoticed from
// the Playwright base) — so every gate passed on a runtime that shipped nowhere.
// Also pins pnpm in images and Actions workflows because node:26 no longer
// resolves packageManager through a bundled corepack binary.
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
const ACTIONS_WORKFLOW = ".github/workflows/ci.yml";
const EXPECTED_ACTION_SETUP_COUNT = 4;
const ACTION_SHA_LENGTH = 40;

const readRootManifest = (): RootManifest =>
  JSON.parse(read(ROOT_MANIFEST)) as RootManifest;

const majorOf = (version: string): string | undefined =>
  /(\d+)/.exec(version)?.[1];

// `FROM node:<major>-<variant>@sha256:… AS base`
const imageNodeMajors = (): readonly Declaration[] =>
  DOCKERFILES.map((file) => ({
    source: `${file} base image`,
    value: /FROM node:(\d+)-[a-z]+@sha256:[0-9a-f]{64}/.exec(read(file))?.[1],
  }));

const catalogTypesNodeMajor = (): Declaration => ({
  source: `${WORKSPACE_MANIFEST} catalog @types/node`,
  value: majorOf(
    /^ +"@types\/node": "([^"]+)"$/m.exec(read(WORKSPACE_MANIFEST))?.[1] ?? "",
  ),
});

const declarations = (): readonly Declaration[] => [
  { source: ".nvmrc", value: majorOf(read(".nvmrc").trim()) },
  {
    source: "package.json engines.node",
    value: majorOf(readRootManifest().engines.node),
  },
  ...imageNodeMajors(),
  catalogTypesNodeMajor(),
];

const majorless = (packageManager: string): string | undefined =>
  /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1];

const workflowPnpmPins = (file: string): readonly Declaration[] => {
  const content = read(file);
  const setupCount = [...content.matchAll(/- name: Setup pnpm/g)].length;
  const steps = [
    ...content.matchAll(
      /- name: Setup pnpm\n\s+uses: pnpm\/action-setup@([0-9a-f]{40}) # v(\d+\.\d+\.\d+)\n\s+with:\n\s+version: (\d+\.\d+\.\d+)/g,
    ),
  ];
  const pins = steps.map((step) => {
    const actionSha = step[1];
    const actionVersion = step[2];
    return actionSha?.length === ACTION_SHA_LENGTH &&
      actionVersion !== undefined
      ? step[3]
      : undefined;
  });

  return Array.from({ length: EXPECTED_ACTION_SETUP_COUNT }, (_, index) => {
    return {
      source: `${file} Setup pnpm ${index + 1}`,
      value:
        setupCount === EXPECTED_ACTION_SETUP_COUNT ? pins[index] : undefined,
    };
  });
};

// The action setup stays SHA-pinned and its requested pnpm version must agree
// with the repository packageManager pin.
const pnpmPins = (): readonly Declaration[] => [
  {
    source: "package.json packageManager",
    value: majorless(readRootManifest().packageManager),
  },
  ...DOCKERFILES.map((file) => ({
    source: `${file} npm install -g`,
    value: /npm install -g pnpm@(\d+\.\d+\.\d+)/.exec(read(file))?.[1],
  })),
  ...workflowPnpmPins(ACTIONS_WORKFLOW),
];

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

const nodeOk = report("Node major", declarations());
const pnpmOk = report("pnpm version", pnpmPins());

process.exit(nodeOk && pnpmOk ? 0 : 1);
