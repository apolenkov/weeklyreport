/**
 * Canonical seed constants for CustomReport.
 *
 * Single source of truth for UUIDs, names, and IDs used by both the seed
 * script (prisma/seed.ts) and the tRPC dev session context
 * (apps/api/src/infrastructure/trpc/trpc.context.ts).
 *
 * UUID range allocation (avoid collisions):
 *   - Reports:  ...0001 - ...0009
 *   - Leads:    ...0011 - ...0016
 *   - Head:     ...0099
 *   - Viewer:   ...0098
 *   - Groups:   ...0301 - ...0399
 *   - Products: ...0201 - ...020c
 *   - Stages:   ...0701 - ...0707
 */

export const HEAD_USER_ID = "a0000000-0000-4000-8000-000000000099";
export const VIEWER_USER_ID = "a0000000-0000-4000-8000-000000000098";

export const ACTIVE_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
export const PUBLISHED_REPORT_ID = "a0000000-0000-4000-8000-000000000002";
export const DEFAULT_REPORTING_GROUP_ID =
  "a0000000-0000-4000-8000-000000000301";

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "head" | "viewer" | "lead";
  samlId: string;
  reportingGroupId: string;
};

export type SeedReportingGroup = {
  id: string;
  name: string;
  description: string;
};

export const SEED_REPORTING_GROUPS: readonly SeedReportingGroup[] = [
  {
    id: DEFAULT_REPORTING_GROUP_ID,
    name: "Core Development",
    description: "Default reporting group for CustomReport demo users",
  },
] as const;

/**
 * 8 seed users: 1 head, 1 viewer, 6 leads.
 *
 * Lead names and roles come from apps/web/src/components/dashboard/mock-data.ts
 * MOCK_LEADS — these are canonical because 30+ E2E assertions reference them.
 *
 * Lead UUIDs use range ...0011 through ...0016 to avoid collision with
 * report UUIDs (...0001, ...0002).
 */
export const SEED_USERS: readonly SeedUser[] = [
  {
    id: HEAD_USER_ID,
    email: "head@customreport.local",
    name: "Антон К.",
    role: "head",
    samlId: "head-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: VIEWER_USER_ID,
    email: "viewer@customreport.local",
    name: "Дарья В.",
    role: "viewer",
    samlId: "viewer-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  // Phase 35-08: lead names switched to RU Cyrillic so the dashboard +
  // forms match the rest of the demo content. Tests that pin against the
  // legacy person-specific lead strings have been updated alongside the
  // seed (see /Users/ap/work/customreport/.planning/phases/35-ux-polish/
  // 35-08-SUMMARY.md for the full RU sweep).
  {
    id: "a0000000-0000-4000-8000-000000000011",
    email: "lead1@customreport.local",
    name: "Василий И.",
    role: "lead",
    samlId: "lead-1",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000012",
    email: "maria@customreport.local",
    name: "Мария К.",
    role: "lead",
    samlId: "lead-maria",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000013",
    email: "igor@customreport.local",
    name: "Игорь В.",
    role: "lead",
    samlId: "lead-igor",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000014",
    email: "dmitry@customreport.local",
    name: "Дмитрий С.",
    role: "lead",
    samlId: "lead-dmitry",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000015",
    email: "olga@customreport.local",
    name: "Ольга Н.",
    role: "lead",
    samlId: "lead-olga",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000016",
    email: "sergey@customreport.local",
    name: "Сергей Т.",
    role: "lead",
    samlId: "lead-sergey",
    reportingGroupId: DEFAULT_REPORTING_GROUP_ID,
  },
] as const;

export const LEAD_IDS = SEED_USERS.filter((u) => u.role === "lead").map(
  (u) => u.id,
);

// Convenience lead ID lookups (named for clarity in seed.ts)
export const LEAD_1_ID = "a0000000-0000-4000-8000-000000000011";
export const LEAD_MARIA_ID = "a0000000-0000-4000-8000-000000000012";
export const LEAD_IGOR_ID = "a0000000-0000-4000-8000-000000000013";
export const LEAD_DMITRY_ID = "a0000000-0000-4000-8000-000000000014";
export const LEAD_OLGA_ID = "a0000000-0000-4000-8000-000000000015";
export const LEAD_SERGEY_ID = "a0000000-0000-4000-8000-000000000016";

export type SeedProduct = {
  id: string;
  name: string;
  leadId: string;
};

/**
 * 12 products, 2 per lead. Names per PLAN 20-01 (this redefines the
 * canonical product set — admin/dashboard mocks diverge from this list
 * and will be reconciled in Phase 21).
 */
// Phase 35-08: product names switched to RU Cyrillic for the demo. The
// IDs and lead assignments are unchanged so existing tests + UUID-keyed
// fixtures keep working.
export const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    id: "a0000000-0000-4000-8000-000000000201",
    name: "Маркетинговый портал",
    leadId: LEAD_1_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000202",
    name: "Аналитический хаб",
    leadId: LEAD_1_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000203",
    name: "Платформа интеграций",
    leadId: LEAD_MARIA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000204",
    name: "Платформа e-commerce",
    leadId: LEAD_MARIA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000205",
    name: "Внутренний BI",
    leadId: LEAD_IGOR_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000206",
    name: "AI/ML конвейер",
    leadId: LEAD_IGOR_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000207",
    name: "DevOps-инструменты",
    leadId: LEAD_DMITRY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000208",
    name: "Шлюз безопасности",
    leadId: LEAD_DMITRY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000209",
    name: "Платёжный шлюз",
    leadId: LEAD_OLGA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020a",
    name: "Партнёрский портал",
    leadId: LEAD_OLGA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020b",
    name: "HR-система",
    leadId: LEAD_SERGEY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020c",
    name: "Учёт ресурсов",
    leadId: LEAD_SERGEY_ID,
  },
] as const;

export type SeedStage = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * 7 SDLC stages. Using full name 'Development' (not 'Dev') per admin
 * mock STAGE_NAMES — this is canonical because admin E2E assertions
 * use the full names.
 */
export const SEED_STAGES: readonly SeedStage[] = [
  {
    id: "a0000000-0000-4000-8000-000000000701",
    name: "Planning",
    sortOrder: 0,
  },
  {
    id: "a0000000-0000-4000-8000-000000000702",
    name: "Analysis",
    sortOrder: 1,
  },
  { id: "a0000000-0000-4000-8000-000000000703", name: "Design", sortOrder: 2 },
  {
    id: "a0000000-0000-4000-8000-000000000704",
    name: "Development",
    sortOrder: 3,
  },
  { id: "a0000000-0000-4000-8000-000000000705", name: "Testing", sortOrder: 4 },
  { id: "a0000000-0000-4000-8000-000000000706", name: "DevOps", sortOrder: 5 },
  { id: "a0000000-0000-4000-8000-000000000707", name: "Support", sortOrder: 6 },
] as const;

export type SeedReport = {
  id: string;
  periodStart: string;
  periodEnd: string;
  deadline: string;
  weekLabel: string;
  periodStatus: "open" | "published" | "reopened";
  status: "draft" | "published";
  publishedAt?: string;
};

// ----- Date helpers for date-relative seed -----
// Hardcoded 2026-04-13 (Week 16) drifted into the past; the API auto-creates
// the actual current-week section empty, so demos and Wave 1 tests landed on
// a blank form. Compute Week N (current) and Week N-1 (published) from the
// run time so the seed always populates the page the lead actually opens.

function isoWeekNumber(d: Date): number {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3,
  );
  return (
    1 +
    Math.round(
      (t.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
  );
}

function mondayOfWeek(d: Date): Date {
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - dayNum);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function plusDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 0);
  return r;
}

const NOW = new Date();
const ACTIVE_MONDAY = mondayOfWeek(NOW);
const PREV_MONDAY = plusDays(ACTIVE_MONDAY, -7);

export const SEED_REPORTS = {
  active: {
    id: ACTIVE_REPORT_ID,
    periodStart: ACTIVE_MONDAY.toISOString(),
    periodEnd: endOfDay(plusDays(ACTIVE_MONDAY, 6)).toISOString(),
    // Deadline = Friday 15:00 UTC of the active week.
    deadline: new Date(
      Date.UTC(
        plusDays(ACTIVE_MONDAY, 4).getUTCFullYear(),
        plusDays(ACTIVE_MONDAY, 4).getUTCMonth(),
        plusDays(ACTIVE_MONDAY, 4).getUTCDate(),
        15,
        0,
        0,
      ),
    ).toISOString(),
    weekLabel: `Week ${isoWeekNumber(ACTIVE_MONDAY)}`,
    periodStatus: "open" as const,
    status: "draft" as const,
  },
  published: {
    id: PUBLISHED_REPORT_ID,
    periodStart: PREV_MONDAY.toISOString(),
    periodEnd: endOfDay(plusDays(PREV_MONDAY, 6)).toISOString(),
    deadline: new Date(
      Date.UTC(
        plusDays(PREV_MONDAY, 4).getUTCFullYear(),
        plusDays(PREV_MONDAY, 4).getUTCMonth(),
        plusDays(PREV_MONDAY, 4).getUTCDate(),
        15,
        0,
        0,
      ),
    ).toISOString(),
    weekLabel: `Week ${isoWeekNumber(PREV_MONDAY)}`,
    periodStatus: "published" as const,
    status: "published" as const,
    publishedAt: endOfDay(plusDays(PREV_MONDAY, 6)).toISOString(),
  },
} as const;
