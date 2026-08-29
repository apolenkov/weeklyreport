const ROOTED_REPOSITORY_PATH =
  /^(?:apps|assets|deploy|docs|eslint-config|goals|openspec|packages|patches|prisma|scripts|tools|\.agents|\.codex|\.github|\.husky)\//u;
const UNSUPPORTED_PATH_SYNTAX = /[ *{}<>|]/u;

const REFERENCE_REASONS = [
  "runtime-generated",
  "local-only",
  "historical-contract",
  "removed-path-example",
] as const;

type ReferenceReason = (typeof REFERENCE_REASONS)[number];

export interface MarkdownSource {
  readonly path: string;
  readonly content: string;
}

interface ReferenceLedgerEntry {
  readonly path: string;
  readonly owners: readonly string[];
  readonly reason: ReferenceReason;
  readonly rationale: string;
}

export interface ReferenceLedger {
  readonly version: 1;
  readonly entries: readonly ReferenceLedgerEntry[];
}

export interface ReferenceValidationReport {
  readonly sourceCount: number;
  readonly referenceCount: number;
  readonly missingCount: number;
  readonly exceptionCount: number;
}

type PathExists = (path: string) => boolean;

const ENTRY_KEYS = ["owners", "path", "rationale", "reason"] as const;
const LEDGER_KEYS = ["entries", "version"] as const;
const MINIMUM_RATIONALE_LENGTH = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean =>
  Object.keys(value)
    .toSorted((left, right) => left.localeCompare(right))
    .join("\0") ===
  [...keys].toSorted((left, right) => left.localeCompare(right)).join("\0");

const isReferenceReason = (value: unknown): value is ReferenceReason =>
  typeof value === "string" &&
  (REFERENCE_REASONS as readonly string[]).includes(value);

const isLedgerEntry = (value: unknown): value is ReferenceLedgerEntry =>
  isRecord(value) &&
  hasExactKeys(value, ENTRY_KEYS) &&
  typeof value.path === "string" &&
  ROOTED_REPOSITORY_PATH.test(value.path) &&
  Array.isArray(value.owners) &&
  value.owners.length > 0 &&
  value.owners.every(
    (owner) => typeof owner === "string" && owner.length > 0,
  ) &&
  new Set(value.owners).size === value.owners.length &&
  isReferenceReason(value.reason) &&
  typeof value.rationale === "string" &&
  value.rationale.length >= MINIMUM_RATIONALE_LENGTH;

export const parseReferenceLedger = (raw: string): ReferenceLedger => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    !hasExactKeys(value, LEDGER_KEYS) ||
    value.version !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isLedgerEntry)
  ) {
    throw new Error("Invalid repository path reference ledger");
  }
  return { version: 1, entries: value.entries };
};

const TRAILING_PUNCTUATION = "),.;";

const normalizedReference = (raw: string): string => {
  let normalized = raw.trim();
  while (
    normalized.length > 0 &&
    TRAILING_PUNCTUATION.includes(normalized.at(-1) ?? "")
  )
    normalized = normalized.slice(0, -1);
  return normalized.replace(/:\d+(?:-\d+)?$/u, "");
};

const withoutFencedCode = (content: string): string => {
  let fence: { readonly kind: "`" | "~"; readonly length: number } | null =
    null;
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      const marker = /^(`{3,}|~{3,})/u.exec(trimmed)?.[1];
      if (marker !== undefined && fence === null) {
        const markerKind = marker[0] as "`" | "~";
        fence = { kind: markerKind, length: marker.length };
        return "";
      }
      if (marker !== undefined && fence !== null) {
        const markerKind = marker[0] as "`" | "~";
        const suffix = trimmed.slice(marker.length).trim();
        if (
          markerKind === fence.kind &&
          marker.length >= fence.length &&
          suffix.length === 0
        )
          fence = null;
        return "";
      }
      return fence === null ? line : "";
    })
    .join("\n");
};

const inlineCode = (content: string): readonly string[] => {
  const values: string[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    const opening = content.indexOf("`", cursor);
    if (opening === -1) break;
    if (content[opening - 1] === "`" || content[opening + 1] === "`") {
      cursor = opening + 1;
      continue;
    }
    const closing = content.indexOf("`", opening + 1);
    if (closing === -1) break;
    if (content[closing + 1] !== "`")
      values.push(content.slice(opening + 1, closing));
    cursor = closing + 1;
  }
  return values;
};

const repositoryReferences = (content: string): readonly string[] =>
  inlineCode(withoutFencedCode(content))
    .map(normalizedReference)
    .filter(
      (path) =>
        ROOTED_REPOSITORY_PATH.test(path) &&
        !UNSUPPORTED_PATH_SYNTAX.test(path) &&
        !path.includes("...") &&
        !path.includes("→"),
    );

const compare = (left: string, right: string): number =>
  left.localeCompare(right);

const sameValues = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  [...left].toSorted(compare).join("\0") ===
  [...right].toSorted(compare).join("\0");

const duplicatePaths = (
  entries: readonly ReferenceLedgerEntry[],
): readonly string[] => {
  const counts = new Map<string, number>();
  for (const entry of entries)
    counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([path]) => path)
    .toSorted(compare);
};

export const validateRepositoryPathReferences = (
  sources: readonly MarkdownSource[],
  ledger: ReferenceLedger,
  pathExists: PathExists,
): ReferenceValidationReport => {
  const ownersByReference = new Map<string, Set<string>>();
  let referenceCount = 0;
  for (const source of sources) {
    for (const reference of repositoryReferences(source.content)) {
      referenceCount += 1;
      const owners = ownersByReference.get(reference) ?? new Set<string>();
      owners.add(source.path);
      ownersByReference.set(reference, owners);
    }
  }

  const missing = new Map(
    [...ownersByReference]
      .filter(([path]) => !pathExists(path))
      .map(([path, owners]) => [path, [...owners].toSorted(compare)] as const),
  );
  const ledgerByPath = new Map(
    ledger.entries.map((entry) => [entry.path, entry] as const),
  );
  const errors = [
    ...duplicatePaths(ledger.entries).map(
      (path) => `duplicate ledger path: ${path}`,
    ),
    ...[...missing]
      .filter(([path]) => !ledgerByPath.has(path))
      .map(
        ([path, owners]) =>
          `unclassified missing path: ${path} owners=${owners.join(",")}`,
      ),
    ...[...missing].flatMap(([path, owners]) => {
      const entry = ledgerByPath.get(path);
      return entry !== undefined && !sameValues(entry.owners, owners)
        ? [
            `ledger owner mismatch: ${path} expected=${owners.join(",")} actual=${entry.owners.join(",")}`,
          ]
        : [];
    }),
    ...ledger.entries.flatMap((entry) => {
      if (pathExists(entry.path))
        return [`stale ledger path now exists: ${entry.path}`];
      if (!missing.has(entry.path))
        return [`stale ledger path is no longer referenced: ${entry.path}`];
      return [];
    }),
  ].toSorted(compare);

  if (errors.length > 0)
    throw new Error(
      `repository path reference gate failed:\n${errors.join("\n")}`,
    );

  return {
    sourceCount: sources.length,
    referenceCount,
    missingCount: missing.size,
    exceptionCount: ledger.entries.length,
  };
};
