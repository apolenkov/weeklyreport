// Catalogue ids the hand-written demo rows (cross-author overlay, risks,
// decisions) anchor on. Named here so no module repeats a bare UUID literal;
// the values mirror SEED_PRODUCTS / SEED_STAGES in seed-catalog.ts.

export const PRODUCT_MARKETING_PORTAL = "a0000000-0000-4000-8000-000000000201";
export const PRODUCT_ANALYTICS_HUB = "a0000000-0000-4000-8000-000000000202";
export const PRODUCT_INTERNAL_BI = "a0000000-0000-4000-8000-000000000205";
export const PRODUCT_DEVOPS_TOOLS = "a0000000-0000-4000-8000-000000000207";
export const PRODUCT_SECURITY_GATEWAY = "a0000000-0000-4000-8000-000000000208";
export const PRODUCT_PAYMENT_GATEWAY = "a0000000-0000-4000-8000-000000000209";

// Stage labels stored on items, risks and decisions; they must match the
// seeded Stage.name verbatim or the UI falls back to the '—' placeholder.
export const STAGE_NAME_DEVELOPMENT = "Development";
export const STAGE_NAME_TESTING = "Testing";
export const STAGE_NAME_DEVOPS = "DevOps";
export const STAGE_NAME_SUPPORT = "Support";

export const STAGE_PLANNING = "a0000000-0000-4000-8000-000000000701";
export const STAGE_TESTING = "a0000000-0000-4000-8000-000000000705";
export const STAGE_DEVOPS = "a0000000-0000-4000-8000-000000000706";
export const STAGE_SUPPORT = "a0000000-0000-4000-8000-000000000707";

// Lead slots in the generated-id scheme (1..6), shared by the section, item and
// status generators so a hand-written row lands in the right lead's section.
export const LEAD_SLOT_PRIMARY = 1;
export const LEAD_SLOT_IGOR = 3;
export const LEAD_SLOT_DMITRY = 4;
export const LEAD_SLOT_OLGA = 5;
