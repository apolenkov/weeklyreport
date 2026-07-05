/**
 * Advisory soft caps for slide capacity.
 *
 * These are NON-ENFORCED, tunable recommendations — no Prisma column, Zod
 * `.max()`, or tRPC rejection enforces them. They drive gentle, non-blocking
 * UI advisories only. Tune the numbers freely; nothing breaks if they change.
 */

/** Recommended maximum number of active products a single lead owner carries. */
export const MAX_PRODUCTS_PER_LEAD = 6;
