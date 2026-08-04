import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanCriticalTestFiles } from "./critical-test-marker-gate.ts";
import {
  type EvidenceManifest,
  type EvidenceReference,
  type FindingEvidence,
  parseManifest,
  parseResults,
} from "./p0-evidence-model.ts";

export const EXPECTED_P0_IDS = [
  "E2E-001",
  "SECURITY-SAML-001",
  "STATE-STALE-001",
  "PERIOD-FACTORY-ARCHIVED-001",
  "PERIOD-FACTORY-STATE-COERCION-001",
  "ADMIN-PERIOD-STATE-COERCION-001",
  "UNARCHIVE-CAS-001",
  "AUTH-ACTIVE-WORKSPACE-LIFECYCLE-001",
  "LIFECYCLE-GATE-BYPASS-001",
  "PROJECT-ACTIVITY-GROUP-CAS-001",
  "SECTION-PERIOD-STATUS-NULL-001",
  "PERIOD-SCHEMA-DUAL-STATE-OPTIONAL-001",
  "RESTORE-CONFIRM-TARGET-001",
] as const;

export interface VerificationOptions {
  readonly root: string;
  readonly manifestPath: string;
  readonly resultsPath: string;
  readonly markersOnly?: boolean;
}

const duplicates = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) !== index);

const exactSetErrors = (
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): readonly string[] => [
  ...duplicates(actual).map((value) => `${label} duplicates ${value}`),
  ...expected
    .filter((value) => !actual.includes(value))
    .map((value) => `${label} is missing ${value}`),
  ...actual
    .filter((value) => !expected.includes(value))
    .map((value) => `${label} contains unexpected ${value}`),
];

const fileError = (root: string, path: string): string | undefined => {
  const absolute = resolve(root, path);
  return existsSync(absolute) && statSync(absolute).isFile()
    ? undefined
    : `missing file ${path}`;
};

const referenceErrors = (
  root: string,
  referenceValue: EvidenceReference,
): readonly string[] => {
  const missing = fileError(root, referenceValue.path);
  if (missing) return [missing];
  return readFileSync(resolve(root, referenceValue.path), "utf8").includes(
    referenceValue.needle,
  )
    ? []
    : [`${referenceValue.path} lacks evidence: ${referenceValue.needle}`];
};

const findingErrors = (
  root: string,
  evidence: FindingEvidence,
): readonly string[] => {
  const testPaths = new Set(evidence.tests.map((entry) => entry.path));
  return [
    ...(evidence.resolved ? [] : [`${evidence.id} is unresolved`]),
    ...(evidence.tests.length > 0
      ? []
      : [`${evidence.id} has no direct tests`]),
    ...(evidence.probes.length > 0 ? [] : [`${evidence.id} has no probes`]),
    ...(evidence.commands.length > 0 ? [] : [`${evidence.id} has no commands`]),
    ...[evidence.implementation, evidence.spec]
      .map((path) => fileError(root, path))
      .filter((error): error is string => error !== undefined),
    ...evidence.tests.flatMap((entry) => referenceErrors(root, entry)),
    ...evidence.probes.flatMap((entry) => [
      ...(testPaths.has(entry.path)
        ? []
        : [`${evidence.id} probe is not owned by direct tests: ${entry.path}`]),
      ...referenceErrors(root, entry),
    ]),
  ];
};

const pathsFor = (findingValue: FindingEvidence): readonly string[] => [
  findingValue.implementation,
  findingValue.spec,
  ...findingValue.tests.map((entry) => entry.path),
  ...findingValue.probes.map((entry) => entry.path),
];

export const commandDigest = (
  root: string,
  manifest: EvidenceManifest,
  command: string,
): string => {
  const ownedFindings = manifest.findings.filter((entry) =>
    entry.commands.includes(command),
  );
  const paths = [...new Set(ownedFindings.flatMap(pathsFor))].sort(
    (left, right) => left.localeCompare(right),
  );
  const hash = createHash("sha256").update(command);
  ownedFindings.forEach((entry) => hash.update(JSON.stringify(entry)));
  paths.forEach((path) =>
    hash.update(path).update(readFileSync(resolve(root, path))),
  );
  return hash.digest("hex");
};

export function verifyP0Evidence(
  options: VerificationOptions,
): readonly string[] {
  const manifest = parseManifest(
    JSON.parse(readFileSync(options.manifestPath, "utf8")) as unknown,
  );
  const expected = [...EXPECTED_P0_IDS];
  const baseErrors = [
    ...(manifest.version === 1 ? [] : ["manifest version must be 1"]),
    ...exactSetErrors(manifest.expectedIds, expected, "expectedIds"),
    ...exactSetErrors(
      manifest.findings.map((entry) => entry.id),
      expected,
      "findings",
    ),
    ...duplicates(manifest.findings.map((entry) => entry.owner)).map(
      (owner) => `duplicate owner ${owner}`,
    ),
    ...manifest.findings.flatMap((entry) => findingErrors(options.root, entry)),
  ];
  const testFiles = [
    ...new Set(
      manifest.findings.flatMap((entry) =>
        entry.tests.map((test) => test.path),
      ),
    ),
  ];
  const markerErrors = scanCriticalTestFiles(
    testFiles
      .filter((path) => fileError(options.root, path) === undefined)
      .map((path) => resolve(options.root, path)),
  ).map((marker) => `${marker.file}:${marker.line}: ${marker.reason}`);
  if (options.markersOnly) return [...baseErrors, ...markerErrors];

  const results = parseResults(
    JSON.parse(readFileSync(options.resultsPath, "utf8")) as unknown,
  );
  const commands = [
    ...new Set(manifest.findings.flatMap((entry) => entry.commands)),
  ];
  const resultErrors = [
    ...(results.version === 2 ? [] : ["results version must be 2"]),
    ...duplicates(results.commands.map((entry) => entry.command)).map(
      (command) => `duplicate command result ${command}`,
    ),
    ...commands.flatMap((command) => {
      const result = results.commands.find(
        (entry) => entry.command === command,
      );
      if (!result) return [`missing passing evidence for command: ${command}`];
      if (result.exitCode !== 0) {
        return [`command exited with code ${result.exitCode}: ${command}`];
      }
      return result.sourceDigest ===
        commandDigest(options.root, manifest, command)
        ? []
        : [`stale source digest for command: ${command}`];
    }),
  ];
  return [...baseErrors, ...markerErrors, ...resultErrors];
}

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CHANGE = "openspec/changes/repair-exhaustive-audit-critical-integrity";
const cliArgs = new Set(process.argv.slice(2));
const markersOnly = cliArgs.has("--markers-only");
const printDigests = cliArgs.has("--print-digests");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifestPath = resolve(ROOT, CHANGE, "evidence-manifest.json");
  if (printDigests) {
    const manifest = parseManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    );
    [...new Set(manifest.findings.flatMap((entry) => entry.commands))].forEach(
      (command) =>
        console.log(`${commandDigest(ROOT, manifest, command)}  ${command}`),
    );
  } else {
    const errors = verifyP0Evidence({
      root: ROOT,
      manifestPath,
      resultsPath: resolve(ROOT, CHANGE, "evidence-results.json"),
      markersOnly,
    });
    errors.forEach((error) => console.error(error));
    process.exitCode = errors.length === 0 ? 0 : 1;
  }
}
