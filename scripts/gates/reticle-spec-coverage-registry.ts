import { readFile } from "node:fs/promises";

import { isSafeReticleSegment } from "./reticle-flow-validation.ts";
import type {
  ReticleSpecCoverageEntry,
  ReticleSpecCoverageRegistry,
} from "./reticle-spec-coverage-types.ts";
import { coverageProofError } from "./reticle-spec-coverage-types.ts";
import type { OpenSpecOutcome } from "./reticle-spec-inventory.ts";

export const REGISTRY_VERSION = 2;
export const UNCLASSIFIED_OUTCOME = "unclassified outcome";
const INVALID_OUTCOME_ENTRY = "invalid registry outcome entry";
const SHA256 = /^[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

export function identityKey(
  value: Pick<ReticleSpecCoverageEntry, "spec" | "requirement" | "scenario"> & {
    outcome: Pick<OpenSpecOutcome, "ordinal">;
  },
): string {
  return JSON.stringify([
    value.spec,
    value.requirement,
    value.scenario,
    value.outcome.ordinal,
  ]);
}

function validateOutcomeShape(value: unknown): string | null {
  if (!isRecord(value)) return INVALID_OUTCOME_ENTRY;
  if (
    !Number.isSafeInteger(value.ordinal) ||
    (value.ordinal as number) < 1 ||
    (value.keyword !== "THEN" && value.keyword !== "AND") ||
    typeof value.text !== "string" ||
    value.text.trim() === "" ||
    !isSha256(value.fingerprint)
  ) {
    return INVALID_OUTCOME_ENTRY;
  }
  return null;
}

function validateCoverageShape(value: unknown): string | null {
  if (!isRecord(value) || typeof value.kind !== "string")
    return INVALID_OUTCOME_ENTRY;
  if (value.kind === "unclassified") return UNCLASSIFIED_OUTCOME;
  if (value.kind !== "classified") return "invalid coverage kind";
  if (!Array.isArray(value.proofs) || value.proofs.length === 0)
    return "invalid proof array";
  for (const proof of value.proofs) {
    const error = coverageProofError(proof);
    if (error !== null) return error;
  }
  return null;
}

export function validateEntryIdentity(value: unknown): string | null {
  if (!isRecord(value)) return INVALID_OUTCOME_ENTRY;
  if (
    !isNonEmptyString(value.spec) ||
    !isNonEmptyString(value.requirement) ||
    !isNonEmptyString(value.scenario) ||
    !isSha256(value.fingerprint) ||
    validateOutcomeShape(value.outcome) !== null
  )
    return INVALID_OUTCOME_ENTRY;
  return null;
}

export function validateEntryShape(value: unknown): string | null {
  const identityError = validateEntryIdentity(value);
  if (identityError !== null) return identityError;
  return validateCoverageShape(isRecord(value) ? value.coverage : undefined);
}

function parseRegistry(value: unknown): ReticleSpecCoverageRegistry {
  if (
    !isRecord(value) ||
    value.version !== REGISTRY_VERSION ||
    !isSafeReticleSegment(value.projectId) ||
    !Array.isArray(value.scenarios)
  ) {
    throw new Error("invalid Reticle specification coverage registry");
  }
  // SAFETY: every field read above is type-checked, so the parsed registry
  // already matches the interface and only its static type is missing.
  return value as unknown as ReticleSpecCoverageRegistry;
}

export async function readRegistry(
  path: string,
): Promise<ReticleSpecCoverageRegistry> {
  try {
    return parseRegistry(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") throw error;
    if (error instanceof SyntaxError)
      throw new Error("invalid Reticle specification coverage registry");
    throw error;
  }
}
