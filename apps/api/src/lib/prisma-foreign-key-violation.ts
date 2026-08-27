import {
  type ConstraintViolationScope,
  isPrismaConstraintViolation,
} from "./prisma/constraint-violation.js";

// P2003 — the Prisma error code for a foreign-key constraint violation.
export const PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE = "P2003";

// A scope matches when the error identity contains the constraint name OR all
// of the `columns` (a composite FK); unscoped calls accept any P2003. The pg
// driver leaves `meta.target` unset, so identity is scanned across meta+message.
export type ForeignKeyViolationScope = ConstraintViolationScope;

// True when `error` is a Prisma foreign-key violation. With a `scope`, true only
// when the violation is that scope's constraint (an unrelated P2003 returns
// false, so the caller re-throws it); without a scope, true for any P2003.
export function isForeignKeyViolation(
  error: unknown,
  scope?: ForeignKeyViolationScope,
): boolean {
  return isPrismaConstraintViolation(
    error,
    PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE,
    scope,
  );
}
