import type { Prisma } from "@prisma/client";

/** The Prisma error code for a foreign-key constraint violation. */
export const PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE = "P2003";

/**
 * True when `error` is a Prisma foreign-key violation. The pg driver adapter
 * does not reliably expose a constraint target in `meta`, so detection keys on
 * Prisma's stable top-level code instead of adapter-specific metadata.
  * @param error - The error argument.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    (error as Prisma.PrismaClientKnownRequestError).code ===
      PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE
  );
}
