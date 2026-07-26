#!/usr/bin/env node
// Drift guard: the Node major the code is typed, linted and tested against must
// be the one the shipped images actually execute. Before this guard the repo ran
// three at once — .nvmrc 26, web image 25, api image 24 (inherited unnoticed from
// the Playwright base) — so every gate passed on a runtime that shipped nowhere.
// Also pins pnpm, which node:26 can no longer resolve from packageManager because
// it stopped shipping corepack.
//
// Usage: node scripts/check-runtime-node-sync.mjs
// Exits 0 when every declaration agrees, 1 (naming each) when they drift.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const read = (file) => fs.readFileSync(path.join(repoRoot, file), "utf8");
const readJson = (file) => JSON.parse(read(file));

const ROOT_MANIFEST = "package.json";

// One declaration, because every manifest resolves `@types/node` through
// `catalog:` — pnpm enforces the agreement at install time, so this guard only
// has to check that the single catalogued major matches the runtime.
const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

const DOCKERFILES = ["Dockerfile.api", "Dockerfile.web"];

const majorOf = (version) => version.match(/(\d+)/)?.[1];

// `FROM node:<major>-<variant>@sha256:… AS base`
const imageNodeMajors = () =>
  DOCKERFILES.map((file) => ({
    source: `${file} base image`,
    major: read(file).match(/FROM node:(\d+)-[a-z]+@sha256:[0-9a-f]{64}/)?.[1],
  }));

const catalogTypesNodeMajor = () => ({
  source: `${WORKSPACE_MANIFEST} catalog @types/node`,
  major: majorOf(
    read(WORKSPACE_MANIFEST).match(/^ +"@types\/node": "([^"]+)"$/m)?.[1] ?? "",
  ),
});

const declarations = () => [
  { source: ".nvmrc", major: majorOf(read(".nvmrc").trim()) },
  {
    source: "package.json engines.node",
    major: majorOf(readJson(ROOT_MANIFEST).engines.node),
  },
  ...imageNodeMajors(),
  catalogTypesNodeMajor(),
];

// pnpm is installed with `npm install -g pnpm@<version>` in both images because
// node:26 dropped corepack, which used to read packageManager for us.
const pnpmPins = () => {
  const declared = readJson(ROOT_MANIFEST).packageManager;
  return [
    { source: "package.json packageManager", pin: majorless(declared) },
    ...DOCKERFILES.map((file) => ({
      source: `${file} npm install -g`,
      pin: read(file).match(/npm install -g pnpm@(\d+\.\d+\.\d+)/)?.[1],
    })),
  ];
};

const majorless = (packageManager) =>
  packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1];

const report = (label, entries, key) => {
  const unreadable = entries.filter((entry) => entry[key] === undefined);
  const values = new Set(entries.map((entry) => entry[key]));
  const lines = entries.map((entry) => `  ${entry.source}: ${entry[key]}`);

  if (unreadable.length > 0) {
    console.error(
      `Could not read the ${label} from:\n${unreadable
        .map((entry) => `  ${entry.source}`)
        .join("\n")}`,
    );
    return false;
  }
  if (values.size > 1) {
    console.error(
      `${label} drift — these must all agree:\n${lines.join("\n")}`,
    );
    return false;
  }
  console.log(`${label} in sync: ${[...values][0]}`);
  return true;
};

const nodeOk = report("Node major", declarations(), "major");
const pnpmOk = report("pnpm version", pnpmPins(), "pin");

process.exit(nodeOk && pnpmOk ? 0 : 1);
