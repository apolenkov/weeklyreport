import type { Prisma } from "@prisma/client";

// P2003 — the Prisma error code for a foreign-key constraint violation.
export const PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE = "P2003";

// A scope matches when the error identity contains the constraint name OR all
// of the `columns` (a composite FK); unscoped calls accept any P2003. The pg
// driver leaves `meta.target` unset, so identity is scanned across meta+message.
export interface ForeignKeyViolationScope {
  // Exact constraint name, e.g. `RecordComment_itemId_fkey`.
  readonly index?: string;
  // Exact column names, ALL of which must appear.
  readonly columns?: readonly string[];
}

// JSON.stringify that never throws (a circular / BigInt meta degrades to "").
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

// Escapes a literal identifier before embedding it in a RegExp source.
function escapeRegex(identifier: string): string {
  return identifier.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// Matches an identifier only when adjacent characters are non-identifiers.
function containsIdentityToken(identity: string, identifier: string): boolean {
  const escapedIdentifier = escapeRegex(identifier);
  const pattern = `(?:^|[^A-Za-z0-9_])${escapedIdentifier}(?![A-Za-z0-9_])`;
  return new RegExp(pattern).test(identity);
}

// True when `error` is a Prisma foreign-key violation. With a `scope`, true only
// when the violation is that scope's constraint (an unrelated P2003 returns
// false, so the caller re-throws it); without a scope, true for any P2003.
export function isForeignKeyViolation(
  error: unknown,
  scope?: ForeignKeyViolationScope,
): boolean {
  if (!error || typeof error !== "object") return false;
  if (
    (error as Prisma.PrismaClientKnownRequestError).code !==
    PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE
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
