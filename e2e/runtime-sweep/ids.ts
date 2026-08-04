import { createHash } from "node:crypto";

import type { Action, Role, SeedProfile, StateAxes } from "./contracts.ts";

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/;

export class InvalidSourceShaError extends Error {
  override readonly name = "InvalidSourceShaError";

  constructor(readonly value: string) {
    super(
      `Source SHA must be exactly 40 lowercase hexadecimal characters: ${value}`,
    );
  }
}

function serializePrimitive(value: unknown): string | undefined {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) {
    throw new TypeError("Cannot digest a non-finite number");
  }
  return String(value);
}

function serialize(value: unknown): string {
  const primitive = serializePrimitive(value);
  if (primitive !== undefined) return primitive;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  if (value === null || typeof value !== "object") {
    throw new TypeError(`Cannot digest values of type ${typeof value}`);
  }
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${serialize(entry)}`)
    .join(",")}}`;
}

export function stableSerialize(value: unknown): string {
  return serialize(value);
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256")
    .update(stableSerialize(value), "utf8")
    .digest("hex");
}

export function assertSourceSha(value: string): void {
  if (!SOURCE_SHA_PATTERN.test(value)) throw new InvalidSourceShaError(value);
}

export function stableId(namespace: string, value: unknown): string {
  if (namespace.trim() === "")
    throw new TypeError("Stable id namespace cannot be empty");
  return `${namespace}-${sha256Hex(value)}`;
}

export interface CellIdentityInput {
  readonly sourceSha: string;
  readonly profile: SeedProfile;
  readonly role: Role;
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
  readonly state: StateAxes;
  readonly action: Action;
}

export function makeStateId(
  sourceSha: string,
  generatorSeed: string,
  state: StateAxes,
): string {
  assertSourceSha(sourceSha);
  return stableId("state", { sourceSha, generatorSeed, state });
}

export function makeCellId(input: CellIdentityInput): string {
  assertSourceSha(input.sourceSha);
  return stableId("cell", input);
}

export interface ArtifactIdentityInput {
  readonly cellId: string;
  readonly sourceSha: string;
  readonly archivePath: string;
  readonly content: unknown;
}

export function makeArtifactId(input: ArtifactIdentityInput): string {
  assertSourceSha(input.sourceSha);
  return stableId("artifact", input);
}

export interface CandidateIdentityInput {
  readonly cellId: string;
  readonly sourceSha: string;
  readonly kind: string;
  readonly evidenceIds: readonly string[];
}

export function makeCandidateId(input: CandidateIdentityInput): string {
  assertSourceSha(input.sourceSha);
  return stableId("candidate", input);
}
