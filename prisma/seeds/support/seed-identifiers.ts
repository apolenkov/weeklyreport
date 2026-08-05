// Canonical seed UUIDs and dev-login emails — the leaf every other seed module
// reads from. Ranges are allocated so a new id cannot collide: reports
// 0001-0009, leads 0011-0016, admin 0097, viewer 0098, head 0099, products
// 0201-020c, groups 0301-0399, stages 0701-0707.

import { DEFAULT_REPORTING_GROUP } from "../../../packages/shared/src/organization/default-reporting-group.js";

export const HEAD_USER_ID = "a0000000-0000-4000-8000-000000000099";
export const VIEWER_USER_ID = "a0000000-0000-4000-8000-000000000098";
export const ADMIN_USER_ID = "a0000000-0000-4000-8000-000000000097";

export const LEAD_1_ID = "a0000000-0000-4000-8000-000000000011";
export const LEAD_MARIA_ID = "a0000000-0000-4000-8000-000000000012";
export const LEAD_IGOR_ID = "a0000000-0000-4000-8000-000000000013";
export const LEAD_DMITRY_ID = "a0000000-0000-4000-8000-000000000014";
export const LEAD_OLGA_ID = "a0000000-0000-4000-8000-000000000015";
export const LEAD_SERGEY_ID = "a0000000-0000-4000-8000-000000000016";

// The 4 canonical dev-login role emails (mirrors the shared
// `DEV_LOGIN_EMAIL_BY_ROLE` in packages/shared/src/schemas/auth/auth.ts — this
// prisma toolchain's isolated tsconfig.prisma.json cannot resolve workspace
// packages, so this is a literal, not an import).
export const HEAD_EMAIL = "head@customreport.local";
export const VIEWER_EMAIL = "viewer@customreport.local";
export const ADMIN_EMAIL = "admin@customreport.local";
export const LEAD_1_EMAIL = "lead1@customreport.local";

export const ACTIVE_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
export const PUBLISHED_REPORT_ID = "a0000000-0000-4000-8000-000000000002";
export const HISTORY_REPORT_2_ID = "a0000000-0000-4000-8000-000000000003";
export const HISTORY_REPORT_3_ID = "a0000000-0000-4000-8000-000000000004";
export const HISTORY_REPORT_4_ID = "a0000000-0000-4000-8000-000000000005";

export const DEFAULT_REPORTING_GROUP_ID = DEFAULT_REPORTING_GROUP.id;
