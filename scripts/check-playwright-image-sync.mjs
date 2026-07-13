#!/usr/bin/env node
// Drift guard: the Playwright base image in Dockerfile.api ships a Chromium
// revision coupled to a specific Playwright version, and the image runs with
// PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1. If the resolved `playwright` dependency
// drifts from the image tag, PDF export fails at chromium.launch() in the built
// image while unit/E2E suites (which run their own `playwright install`) stay
// green. This guard fails loud when the two pins diverge.
//
// Usage: node scripts/check-playwright-image-sync.mjs
// Exits 0 when the versions match, 1 (naming both) when they drift.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readVersion = (label, file, pattern) => {
  const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
  const match = source.match(pattern);
  if (!match) {
    console.error(`Could not read the ${label} from ${file}.`);
    process.exit(1);
  }
  return match[1];
};

// FROM mcr.microsoft.com/playwright:v<x.y.z>-noble AS base
const imageTag = readVersion(
  "Playwright base image tag",
  "Dockerfile.api",
  /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble(?:@sha256:[0-9a-f]{64})?\s+AS\s+base/,
);

// The version the apps/api importer actually resolves — read from the
// lockfile's `importers` block for apps/api, NOT the first global
// `playwright@x.y.z:` snapshot key: with two resolved Playwright versions in
// the monorepo the global key order is arbitrary, and the image only has to
// match what apps/api (the PDF-export runtime) bundles. Parsed in two linear
// steps (slice the importer block, then match inside it) so no single regex
// has to scan the whole lockfile.
const readApiImporterPlaywrightVersion = () => {
  const source = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
  const importerStart = source.indexOf("\n  apps/api:");
  // The next two-space-indented key (whatever importer or top-level section
  // follows) ends the apps/api importer block.
  const tail = source.slice(importerStart + 1);
  const nextKey = tail.slice(1).match(/\n {2}\S/);
  const block =
    importerStart === -1
      ? ""
      : nextKey?.index === undefined
        ? tail
        : tail.slice(0, nextKey.index + 1);
  const match = block.match(
    /^ {6}playwright:\n {8}specifier: [^\n]+\n {8}version: (\d+\.\d+\.\d+)/m,
  );
  if (!match) {
    console.error(
      "Could not read the apps/api importer's playwright version from pnpm-lock.yaml.",
    );
    process.exit(1);
  }
  return match[1];
};
const resolved = readApiImporterPlaywrightVersion();

if (imageTag !== resolved) {
  console.error(
    `Playwright image/dependency drift: Dockerfile.api base image is ` +
      `v${imageTag}-noble but pnpm-lock.yaml resolves playwright@${resolved}. ` +
      `Update the Dockerfile.api tag to v${resolved}-noble (or realign the ` +
      `dependency) so the baked Chromium revision matches.`,
  );
  process.exit(1);
}

console.log(
  `Playwright image/dependency in sync: v${imageTag}-noble === playwright@${resolved}.`,
);
