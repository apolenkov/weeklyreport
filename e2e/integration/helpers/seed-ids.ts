/**
 * Single source of truth for seed identifiers used by integration specs.
 *
 * Re-exports from prisma/seed-constants.ts so spec files NEVER hardcode UUIDs
 * or emails. If the seed changes, this file changes — specs stay stable.
 *
 * Why a relative `../../../../../prisma/...` path: the integration suite has
 * its own tsconfig (extends apps/web/e2e/tsconfig.json which uses CommonJS +
 * Node moduleResolution + no path aliases). It cannot import via the workspace
 * package alias the way runtime code does. Direct relative import is the
 * least magical choice here.
 */

export {
  ACTIVE_REPORT_ID,
  LEAD_1_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  PUBLISHED_REPORT_ID,
  SEED_PRODUCTS,
  SEED_USERS,
} from "../../../prisma/seed-constants.js";

/**
 * Email map verified against prisma/seed-constants.ts SEED_USERS at this
 * commit. Use the literal email values directly in /auth/dev-login?email=
 * query strings — buildUserSession looks the user up by email.
 */
export const SEED_EMAILS = {
  head: "head@customreport.local",
  viewer: "viewer@customreport.local",
  admin: "admin@customreport.local",
  lead1: "lead1@customreport.local",
  maria: "maria@customreport.local",
  igor: "igor@customreport.local",
  dmitry: "dmitry@customreport.local",
  olga: "olga@customreport.local",
  sergey: "sergey@customreport.local",
} as const;
