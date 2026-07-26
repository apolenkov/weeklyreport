// Deterministic row ids for the simple seed. Fixed UUIDs keep a re-run
// idempotent and let E2E specs address seeded rows without a lookup.

export const HEAD_ID = "a0000000-0000-4000-8000-000000000099";
export const VIEWER_ID = "a0000000-0000-4000-8000-000000000098";
export const ADMIN_ID = "a0000000-0000-4000-8000-000000000097";
export const LEAD_1 = "a0000000-0000-4000-8000-000000000011";
export const LEAD_MARIA = "a0000000-0000-4000-8000-000000000012";
export const LEAD_IGOR = "a0000000-0000-4000-8000-000000000013";
export const LEAD_DMITRY = "a0000000-0000-4000-8000-000000000014";
export const LEAD_OLGA = "a0000000-0000-4000-8000-000000000015";
export const LEAD_SERGEY = "a0000000-0000-4000-8000-000000000016";
// PM (non-technical) leads — MOBILE/CLOUD/DEVOPS only.
// Boris (LEAD_MOBILE_PM) also owns Plan+Analysis+Design on PROD_CRM,
// Vasily owns Dev+Test+DevOps+Support (4/7) — enables cross-author readonly UAT demo.
export const LEAD_MOBILE_PM = "a0000000-0000-4000-8000-000000000022";
export const LEAD_CLOUD_PM = "a0000000-0000-4000-8000-000000000023";
export const LEAD_DEVOPS_PM = "a0000000-0000-4000-8000-000000000024";
// Activity-only lead: attached to an activity but owning ZERO products, so the
// activity-only-submit relaxation (a section with no product content) is an
// exercised path rather than dead code. No Project.leadId ever points here.
export const LEAD_ACTIVITY_ONLY = "a0000000-0000-4000-8000-000000000025";

export const PROD_CRM = "a0000000-0000-4000-8000-000000000201";
export const PROD_MOBILE = "a0000000-0000-4000-8000-000000000203";
export const PROD_CLOUD = "a0000000-0000-4000-8000-000000000205";
export const PROD_DEVOPS = "a0000000-0000-4000-8000-000000000207";
export const PROD_PAYMENTS = "a0000000-0000-4000-8000-000000000209";
export const PROD_HR = "a0000000-0000-4000-8000-00000000020b";
// Vasily's 3 extra products (small-MVP demo — product-switcher + co-author overlay)
export const PROD_CRM_SALES = "a0000000-0000-4000-8000-00000000020d";
export const PROD_CRM_DATA = "a0000000-0000-4000-8000-00000000020f";
export const PROD_CRM_360 = "a0000000-0000-4000-8000-000000000211";

export const STAGE_PLAN = "a0000000-0000-4000-8000-000000000701";
export const STAGE_ANALYSIS = "a0000000-0000-4000-8000-000000000702";
export const STAGE_DESIGN = "a0000000-0000-4000-8000-000000000703";
export const STAGE_DEV = "a0000000-0000-4000-8000-000000000704";
export const STAGE_TEST = "a0000000-0000-4000-8000-000000000705";
export const STAGE_DEVOPS = "a0000000-0000-4000-8000-000000000706";
export const STAGE_SUPPORT = "a0000000-0000-4000-8000-000000000707";

export const REPORT_ACTIVE = "a0000000-0000-4000-8000-000000000001";
export const REPORT_PUBLISHED = "a0000000-0000-4000-8000-000000000002";
export const DEFAULT_REPORTING_GROUP_ID =
  "a0000000-0000-4000-8000-000000000301";
// Second group so head scoping can be tested (head only sees own group's leads)
export const FINANCE_GROUP_ID = "a0000000-0000-4000-8000-000000000302";
export const POLICY_DEADLINE = "a0000000-0000-4000-8000-000000000a01";
export const POLICY_ESCALATION = "a0000000-0000-4000-8000-000000000a02";

// Activity-only lead fixture anchors (own id range, distinct from the ca/cb/cc
// product-activity rows). One activity, its lead link + product label, the
// lead's ACTIVE section and its per-activity status.
export const ACTIVITY_ONLY_ID = "a0000000-0000-4000-8000-00000000cae0";
export const ACTIVITY_ONLY_LEAD_LINK_ID =
  "a0000000-0000-4000-8000-00000000cbe0";
export const ACTIVITY_ONLY_STATUS_ID = "a0000000-0000-4000-8000-00000000cce0";
export const ACTIVITY_ONLY_PRODUCT_LINK_ID =
  "a0000000-0000-4000-8000-00000000cde0";
export const ACTIVITY_ONLY_SECTION_ID = "a0000000-0000-4000-8000-00000000040a";
