type SuppressionVerdict = "unadjudicated" | "remove" | "replace" | "retain";

interface SuppressionLedgerEntry {
  readonly path: string;
  readonly line: number;
  readonly scope: "file" | "next-line" | "line";
  readonly rule: string;
  readonly reason: string;
  readonly target: string;
  readonly fingerprint: string;
  readonly owner: string;
  readonly verdict: SuppressionVerdict;
  readonly proof: string | null;
  readonly implementationCommit: string | null;
}

interface SuppressionNoiseEntry {
  readonly path: string;
  readonly line: number;
  readonly excerpt: string;
  readonly fingerprint: string;
  readonly verdict: "replace";
  readonly reason: string;
  readonly implementationCommit: string;
}

export interface SuppressionLedger {
  readonly version: 1;
  readonly startingSnapshot: {
    readonly commit: string;
    readonly rawMatches: number;
    readonly directives: number;
    readonly noise: number;
  };
  readonly entries: readonly SuppressionLedgerEntry[];
  readonly noiseEntries: readonly SuppressionNoiseEntry[];
}

const ENTRY_KEYS = [
  "path",
  "line",
  "scope",
  "rule",
  "reason",
  "target",
  "fingerprint",
  "owner",
  "verdict",
  "proof",
  "implementationCommit",
] as const;
const NOISE_KEYS = [
  "path",
  "line",
  "excerpt",
  "fingerprint",
  "verdict",
  "reason",
  "implementationCommit",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(value)
    .toSorted((left, right) => left.localeCompare(right))
    .join("\0") ===
  [...keys].toSorted((left, right) => left.localeCompare(right)).join("\0");

const isOptionalString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isEntry = (value: unknown): value is SuppressionLedgerEntry =>
  isRecord(value) &&
  exactKeys(value, ENTRY_KEYS) &&
  typeof value.path === "string" &&
  typeof value.line === "number" &&
  Number.isInteger(value.line) &&
  (value.scope === "file" ||
    value.scope === "next-line" ||
    value.scope === "line") &&
  typeof value.rule === "string" &&
  typeof value.reason === "string" &&
  typeof value.target === "string" &&
  typeof value.fingerprint === "string" &&
  typeof value.owner === "string" &&
  (value.verdict === "unadjudicated" ||
    value.verdict === "remove" ||
    value.verdict === "replace" ||
    value.verdict === "retain") &&
  isOptionalString(value.proof) &&
  isOptionalString(value.implementationCommit);

const isNoiseEntry = (value: unknown): value is SuppressionNoiseEntry =>
  isRecord(value) &&
  exactKeys(value, NOISE_KEYS) &&
  typeof value.path === "string" &&
  typeof value.line === "number" &&
  Number.isInteger(value.line) &&
  typeof value.excerpt === "string" &&
  typeof value.fingerprint === "string" &&
  value.verdict === "replace" &&
  typeof value.reason === "string" &&
  typeof value.implementationCommit === "string";

export const parseSuppressionLedger = (raw: string): SuppressionLedger => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "version",
      "startingSnapshot",
      "entries",
      "noiseEntries",
    ])
  )
    throw new Error("Invalid ESLint suppression ledger");
  const snapshot = value.startingSnapshot;
  if (
    value.version !== 1 ||
    !isRecord(snapshot) ||
    !exactKeys(snapshot, ["commit", "rawMatches", "directives", "noise"]) ||
    typeof snapshot.commit !== "string" ||
    typeof snapshot.rawMatches !== "number" ||
    !Number.isInteger(snapshot.rawMatches) ||
    typeof snapshot.directives !== "number" ||
    !Number.isInteger(snapshot.directives) ||
    typeof snapshot.noise !== "number" ||
    !Number.isInteger(snapshot.noise) ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isEntry) ||
    !Array.isArray(value.noiseEntries) ||
    !value.noiseEntries.every(isNoiseEntry)
  )
    throw new Error("Invalid ESLint suppression ledger");
  const identities = value.entries.map(
    (entry) =>
      `${entry.path}\0${entry.line}\0${entry.fingerprint}\0${entry.rule}`,
  );
  if (new Set(identities).size !== identities.length)
    throw new Error("Duplicate ESLint suppression ledger identity");
  return {
    version: 1,
    startingSnapshot: {
      commit: snapshot.commit,
      rawMatches: snapshot.rawMatches,
      directives: snapshot.directives,
      noise: snapshot.noise,
    },
    entries: value.entries,
    noiseEntries: value.noiseEntries,
  };
};
