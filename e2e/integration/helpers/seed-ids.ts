/**
 * Single source of truth for seed identifiers used by integration specs.
 *
 * Re-exports from prisma/seed-constants.ts so spec files NEVER hardcode UUIDs
 * or emails. If the seed changes, this file changes — specs stay stable.
 *
 * Why a relative `../../../prisma/...` path: the integration suite has
 * its own tsconfig (extends apps/web/e2e/tsconfig.json which uses CommonJS +
 * Node moduleResolution + no path aliases). It cannot import via the workspace
 * package alias the way runtime code does. Direct relative import is the
 * least magical choice here.
 */

import { SEED_USERS } from "../../../prisma/seed-constants.js";
export { SEED_USERS };

export {
  ACTIVE_REPORT_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  PUBLISHED_REPORT_ID,
  SEED_PRODUCTS,
} from "../../../prisma/seed-constants.js";

const emailFor = (email: string): string => {
  const user = SEED_USERS.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`Seed user missing for ${email}`);
  return user.email;
};

export const SEED_EMAILS = {
  head: emailFor("head@customreport.local"),
  viewer: emailFor("viewer@customreport.local"),
  admin: emailFor("admin@customreport.local"),
  lead1: emailFor("lead1@customreport.local"),
  maria: emailFor("maria@customreport.local"),
  igor: emailFor("igor@customreport.local"),
  dmitry: emailFor("dmitry@customreport.local"),
  olga: emailFor("olga@customreport.local"),
  sergey: emailFor("sergey@customreport.local"),
} as const;
