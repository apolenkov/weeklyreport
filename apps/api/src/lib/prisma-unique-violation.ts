import type { Prisma } from "@prisma/client";

/**
 * Shared detector for a Prisma unique-constraint violation (P2002), matching the
 * shape this app's pg driver adapter actually produces. Under that adapter a
 * genuine P2002 leaves `meta.target` UNSET; the constraint identity surfaces in
 * the top-level `message` and in serialized `meta`
 * (`meta.driverAdapterError.cause.originalMessage`). Matching `meta.target`
 * alone therefore returns false for a real race and re-throws it as a raw 500 —
 * the latent bug this module removes. So identity is scanned across serialized
 * `meta` + `message`, which also covers the classic-engine `meta.target` form as
 * a backstop.
 */

/** The Prisma error code for a unique-constraint (P2002) violation. */
export const PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

/**
 * Narrows a P2002 to a specific constraint. A scope matches when the error
 * identity contains the `index` name OR ALL of the `columns` (a composite
 * index). A scoped call re-throws an unrelated P2002; an unscoped call
 * (no scope) accepts any P2002.
 */
export interface UniqueViolationScope {
  /** Exact constraint / index name, e.g. `Report_one_open_per_boundary`. */
  readonly index?: string;
  /** Exact column names, ALL of which must appear (a composite index). */
  readonly columns?: readonly string[];
}

/** JSON.stringify that never throws (a circular / BigInt meta degrades to ""). */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/** Escapes a literal identifier before embedding it in a RegExp source. */
function escapeRegex(identifier: string): string {
  return identifier.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Matches an identifier only when adjacent characters are non-identifiers. */
function containsIdentityToken(identity: string, identifier: string): boolean {
  const escapedIdentifier = escapeRegex(identifier);
  const pattern = `(?:^|[^A-Za-z0-9_])${escapedIdentifier}(?![A-Za-z0-9_])`;
  return new RegExp(pattern).test(identity);
}

/**
 * True when `error` is a Prisma P2002 unique-constraint violation. With a
 * `scope`, true only when the violation is that scope's constraint (an
 * unrelated P2002 returns false, so the caller re-throws it); without a scope,
 * true for any P2002.
 */
export function isUniqueViolation(
  error: unknown,
  scope?: UniqueViolationScope,
): boolean {
  if (!error || typeof error !== "object") return false;
  if (
    (error as Prisma.PrismaClientKnownRequestError).code !==
    PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE
  ) {
    return false;
  }
  if (!scope) return true;

  const { meta, message } = error as { meta?: unknown; message?: unknown };
  const identity = `${meta === undefined ? "" : safeJson(meta)} ${
    typeof message === "string" ? message : ""
  }`;

  const indexMatch =
    scope.index !== undefined && containsIdentityToken(identity, scope.index);
  const columnsMatch =
    scope.columns !== undefined &&
    scope.columns.length > 0 &&
    scope.columns.every((column) => containsIdentityToken(identity, column));

  return indexMatch || columnsMatch;
}
