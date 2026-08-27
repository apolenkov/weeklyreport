import {
  type ConstraintViolationScope,
  isPrismaConstraintViolation,
} from "./prisma/constraint-violation.js";

// Shared detector for a Prisma unique-constraint violation (P2002) matching the
// shape the pg driver adapter produces: `meta.target` is UNSET, so identity is
// scanned across `message` + serialized `meta` (classic `meta.target` as backstop).
export const PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

// A scope matches when the error identity contains the `index` name OR ALL of
// the `columns` (a composite index). A scoped call re-throws an unrelated P2002;
// an unscoped call accepts any P2002.
export type UniqueViolationScope = ConstraintViolationScope;

// True when `error` is a Prisma P2002 unique-constraint violation. With a
// `scope`, true only when the violation is that scope's constraint (an unrelated
// P2002 returns false, so the caller re-throws it); without a scope, any P2002.
export function isUniqueViolation(
  error: unknown,
  scope?: UniqueViolationScope,
): boolean {
  return isPrismaConstraintViolation(
    error,
    PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE,
    scope,
  );
}
