import type { DiagnosticSample } from "./preflight-diagnostic-sidecar-contract.ts";

const DIAGNOSTIC_COMPACT_FIELD_KEYS: Readonly<Record<string, string>> = {
  compressedBytes: "cb",
  swapTotalBytes: "st",
  swapUsedBytes: "su",
  swapFreeBytes: "sf",
  swapinsDelta: "si",
  swapoutsDelta: "so",
  pageinsDelta: "pi",
  pageoutsDelta: "po",
  processFootprintBytes: "pf",
  traceRecords: "tr",
  harEntries: "ha",
  artifactBytes: "ab",
};

const DIAGNOSTIC_FIELD_BY_COMPACT_KEY = new Map(
  Object.entries(DIAGNOSTIC_COMPACT_FIELD_KEYS).map(
    ([field, key]) => [key, field] as const,
  ),
);

const recordFor = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  return value as Record<string, unknown>;
};

export function expandedDiagnosticSampleFor(value: unknown): {
  readonly value: unknown;
  readonly containsMixedKeys: boolean;
} {
  const record = recordFor(value);
  if (record === undefined) return { value, containsMixedKeys: false };
  const entries = Object.entries(record);
  const containsCompactKey = entries.some(([key]) =>
    DIAGNOSTIC_FIELD_BY_COMPACT_KEY.has(key),
  );
  if (!containsCompactKey) return { value, containsMixedKeys: false };
  const containsCanonicalKey = entries.some(([key]) =>
    Object.prototype.hasOwnProperty.call(DIAGNOSTIC_COMPACT_FIELD_KEYS, key),
  );
  if (containsCanonicalKey) return { value, containsMixedKeys: true };
  return {
    value: Object.fromEntries(
      entries.map(([key, entryValue]) => [
        DIAGNOSTIC_FIELD_BY_COMPACT_KEY.get(key) ?? key,
        entryValue,
      ]),
    ),
    containsMixedKeys: false,
  };
}

export const compactDiagnosticSampleFor = (
  sample: DiagnosticSample,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(sample).map(([key, value]) => [
      DIAGNOSTIC_COMPACT_FIELD_KEYS[key] ?? key,
      value,
    ]),
  );
