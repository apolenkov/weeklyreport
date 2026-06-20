/**
 * Advisory soft caps for slide capacity (add-slide-capacity-signals).
 *
 * These are NON-ENFORCED, tunable recommendations — no Prisma column, Zod
 * `.max()`, or tRPC rejection enforces them. They drive gentle, non-blocking
 * UI advisories only. Tune the numbers freely; nothing breaks if they change.
 */

/** Recommended maximum number of active products a single lead owner carries. */
export const MAX_PRODUCTS_PER_LEAD = 6;

/**
 * When a single product's record count WITHIN one report section (current /
 * next / risks / decisions) exceeds this, that section shows a quiet "may not
 * fit cleanly on the slide" advisory for that product. Distinct from the
 * Product-scope slide grid's local `MAX_VISIBLE_ITEMS` truncation.
 */
export const SLIDE_SECTION_SOFT_CAP = 5;
