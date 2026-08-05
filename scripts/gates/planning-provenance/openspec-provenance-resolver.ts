import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface ProvenanceCandidate {
  readonly capability: string;
  readonly file: string;
}

export type ProvenanceResolution =
  | {
      readonly status: "resolved";
      readonly reference: string;
      readonly candidate: ProvenanceCandidate;
    }
  | {
      readonly status: "unresolved";
      readonly reference: string;
    }
  | {
      readonly status: "ambiguous";
      readonly reference: string;
      readonly candidates: readonly ProvenanceCandidate[];
    };

const SPEC_FILE = "spec.md";
const MINIMUM_REFERENCE_LENGTH = 3;
const DURABLE_SPEC_REFERENCE =
  /^openspec\/specs\/([a-z0-9][a-z0-9-]+)(?:\/spec[.]md)?$/i;
const ACTIVE_SPEC_REFERENCE =
  /^openspec\/changes\/[a-z0-9][a-z0-9-]+\/specs\/([a-z0-9][a-z0-9-]+)(?:\/spec[.]md)?$/i;
const ACTIVE_CHANGE_REFERENCE = /^openspec\/changes\/([a-z0-9][a-z0-9-]+)\/?$/i;

interface LiveSpec {
  readonly file: string;
  readonly tier: "durable" | "active";
}

const liveSpecFiles = (root: string): readonly LiveSpec[] => {
  const durableRoot = path.join(root, "openspec", "specs");
  const changesRoot = path.join(root, "openspec", "changes");
  const durable = readdirSync(durableRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(durableRoot, entry.name, SPEC_FILE));
  const active = readdirSync(changesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "archive")
    .flatMap((change) => {
      const specsRoot = path.join(changesRoot, change.name, "specs");
      if (!existsSync(specsRoot)) return [];
      return readdirSync(specsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(specsRoot, entry.name, SPEC_FILE));
    });
  return [
    ...durable.map((file) => ({ file, tier: "durable" as const })),
    ...active.map((file) => ({ file, tier: "active" as const })),
  ];
};

const capabilityOf = (file: string): string =>
  path.basename(path.dirname(file));

const normalizedReference = (reference: string): string => {
  const trimmed = reference.trim();
  if (trimmed.length < MINIMUM_REFERENCE_LENGTH)
    throw new Error(
      "A provenance reference must contain at least 3 characters",
    );
  const durable = DURABLE_SPEC_REFERENCE.exec(trimmed);
  if (durable?.[1] !== undefined) return durable[1];
  const active = ACTIVE_SPEC_REFERENCE.exec(trimmed);
  if (active?.[1] !== undefined) return active[1];
  return trimmed;
};

export const resolveOpenSpecProvenance = (
  reference: string,
  root: string,
): ProvenanceResolution => {
  const needle = normalizedReference(reference);
  const lowered = needle.toLowerCase();
  const specs = liveSpecFiles(root);
  const activeChange = ACTIVE_CHANGE_REFERENCE.exec(reference.trim())?.[1];
  const pathMatches =
    activeChange === undefined
      ? []
      : specs.filter(
          ({ file, tier }) =>
            tier === "active" &&
            file.includes(
              `${path.sep}changes${path.sep}${activeChange}${path.sep}`,
            ),
        );
  const exact = specs.filter(
    ({ file }) => capabilityOf(file).toLowerCase() === lowered,
  );
  const content = specs.filter(({ file }) =>
    readFileSync(file, "utf8").toLowerCase().includes(lowered),
  );
  const matches =
    activeChange !== undefined
      ? pathMatches
      : exact.length > 0
        ? exact
        : content.some(({ tier }) => tier === "durable")
          ? content.filter(({ tier }) => tier === "durable")
          : content;
  const candidates = matches
    .map(({ file }) => ({
      capability: capabilityOf(file),
      file: path.relative(root, file),
    }))
    .toSorted((left, right) => left.file.localeCompare(right.file));

  const [candidate, ...rest] = candidates;
  if (candidate === undefined) return { status: "unresolved", reference };
  if (rest.length === 0) return { status: "resolved", reference, candidate };
  return { status: "ambiguous", reference, candidates };
};

const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], "file:").href;

if (isEntrypoint) {
  const [reference] = process.argv.slice(2);
  if (reference === undefined)
    throw new Error(
      "Usage: tsx scripts/gates/planning-provenance/openspec-provenance-resolver.ts <reference>",
    );
  const repoRoot = new URL("../../../", import.meta.url).pathname;
  const resolution = resolveOpenSpecProvenance(reference, repoRoot);
  process.stdout.write(`${JSON.stringify(resolution, undefined, 2)}\n`);
  if (resolution.status !== "resolved") process.exitCode = 1;
}
