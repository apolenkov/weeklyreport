type ScopeClassification =
  "enforcement" | "policy" | "specialization" | "duplicate" | "relaxation debt";

type ScopeMarker =
  | {
      readonly kind: "rule";
      readonly name: string;
      readonly positive: "error" | "warn" | "off";
      readonly negative: "error" | "warn" | "off" | "absent";
    }
  | {
      readonly kind: "rule-options";
      readonly name: string;
      readonly positiveContains: string;
      readonly negativeExcludes: string;
    }
  | {
      readonly kind: "parser-project";
      readonly positive: string;
      readonly negative: "project-service";
    };

interface ScopeLedgerEntry {
  readonly configIndex: number;
  readonly id: string;
  readonly classification: ScopeClassification;
  readonly files: readonly string[];
  readonly ignores: readonly string[];
  readonly positive: string;
  readonly negative: string;
  readonly marker: ScopeMarker;
  readonly evidence: string;
}

export interface ScopeLedger {
  readonly version: 1;
  readonly startingSnapshot: {
    readonly commit: string;
    readonly overrideBlocks: number;
  };
  readonly entries: readonly ScopeLedgerEntry[];
}

const ENTRY_KEYS = [
  "configIndex",
  "id",
  "classification",
  "files",
  "ignores",
  "positive",
  "negative",
  "marker",
  "evidence",
] as const;
const CLASSIFICATIONS = new Set([
  "enforcement",
  "policy",
  "specialization",
  "duplicate",
  "relaxation debt",
]);

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
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const isSeverity = (value: unknown): boolean =>
  value === "error" || value === "warn" || value === "off";

const isMarker = (value: unknown): value is ScopeMarker => {
  if (!isRecord(value)) return false;
  if (value.kind === "rule")
    return (
      exactKeys(value, ["kind", "name", "positive", "negative"]) &&
      typeof value.name === "string" &&
      isSeverity(value.positive) &&
      (isSeverity(value.negative) || value.negative === "absent")
    );
  if (value.kind === "rule-options")
    return (
      exactKeys(value, [
        "kind",
        "name",
        "positiveContains",
        "negativeExcludes",
      ]) &&
      typeof value.name === "string" &&
      typeof value.positiveContains === "string" &&
      typeof value.negativeExcludes === "string"
    );
  return (
    value.kind === "parser-project" &&
    exactKeys(value, ["kind", "positive", "negative"]) &&
    typeof value.positive === "string" &&
    value.negative === "project-service"
  );
};

const isEntry = (value: unknown): value is ScopeLedgerEntry =>
  isRecord(value) &&
  exactKeys(value, ENTRY_KEYS) &&
  typeof value.configIndex === "number" &&
  Number.isInteger(value.configIndex) &&
  typeof value.id === "string" &&
  typeof value.classification === "string" &&
  CLASSIFICATIONS.has(value.classification) &&
  isStringList(value.files) &&
  isStringList(value.ignores) &&
  typeof value.positive === "string" &&
  typeof value.negative === "string" &&
  isMarker(value.marker) &&
  typeof value.evidence === "string";

export const parseScopeLedger = (raw: string): ScopeLedger => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "startingSnapshot", "entries"])
  )
    throw new Error("Invalid ESLint scope ledger");
  const snapshot = value.startingSnapshot;
  if (
    value.version !== 1 ||
    !isRecord(snapshot) ||
    !exactKeys(snapshot, ["commit", "overrideBlocks"]) ||
    typeof snapshot.commit !== "string" ||
    typeof snapshot.overrideBlocks !== "number" ||
    !Number.isInteger(snapshot.overrideBlocks) ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isEntry)
  )
    throw new Error("Invalid ESLint scope ledger");
  const ids = value.entries.map((entry) => entry.id);
  const indexes = value.entries.map((entry) => entry.configIndex);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate ESLint scope ledger id");
  if (new Set(indexes).size !== indexes.length)
    throw new Error("Duplicate ESLint scope ledger config index");
  return {
    version: 1,
    startingSnapshot: {
      commit: snapshot.commit,
      overrideBlocks: snapshot.overrideBlocks,
    },
    entries: value.entries,
  };
};
