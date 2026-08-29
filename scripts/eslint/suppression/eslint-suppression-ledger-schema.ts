interface SuppressionLedgerEntry {
  readonly path: string;
  readonly line: number;
  readonly scope: "file" | "next-line" | "line";
  readonly rule: string;
  readonly reason: string;
  readonly target: string;
  readonly fingerprint: string;
  readonly owner: string;
  readonly verdict: "retain";
  readonly proof: string;
  readonly implementationCommit: string;
}

export interface SuppressionLedger {
  readonly version: 2;
  readonly entries: readonly SuppressionLedgerEntry[];
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
  value.verdict === "retain" &&
  typeof value.proof === "string" &&
  typeof value.implementationCommit === "string";

export const parseSuppressionLedger = (raw: string): SuppressionLedger => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "entries"]) ||
    value.version !== 2 ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isEntry)
  )
    throw new Error("Invalid ESLint suppression ledger");
  const identities = value.entries.map(
    (entry) => `${entry.path}\0${entry.fingerprint}\0${entry.rule}`,
  );
  if (new Set(identities).size !== identities.length)
    throw new Error("Duplicate ESLint suppression ledger identity");
  return { version: 2, entries: value.entries };
};
