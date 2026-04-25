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
 *   - Products: ...0201 - ...020c
 *   - Stages:   ...0701 - ...0707
 */

export const HEAD_USER_ID = 'a0000000-0000-4000-8000-000000000099';
export const VIEWER_USER_ID = 'a0000000-0000-4000-8000-000000000098';

export const ACTIVE_REPORT_ID = 'a0000000-0000-4000-8000-000000000001';
export const PUBLISHED_REPORT_ID = 'a0000000-0000-4000-8000-000000000002';

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: 'head' | 'viewer' | 'lead';
  samlId: string;
};

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
    email: 'head@customreport.local',
    name: 'Department Head',
    role: 'head',
    samlId: 'head-1',
  },
  {
    id: VIEWER_USER_ID,
    email: 'viewer@customreport.local',
    name: 'Report Viewer',
    role: 'viewer',
    samlId: 'viewer-1',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000011',
    email: 'polenkov@customreport.local',
    name: 'Polenkov A.',
    role: 'lead',
    samlId: 'lead-polenkov',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000012',
    email: 'maria@customreport.local',
    name: 'Maria K.',
    role: 'lead',
    samlId: 'lead-maria',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000013',
    email: 'igor@customreport.local',
    name: 'Igor V.',
    role: 'lead',
    samlId: 'lead-igor',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000014',
    email: 'dmitry@customreport.local',
    name: 'Dmitry S.',
    role: 'lead',
    samlId: 'lead-dmitry',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000015',
    email: 'olga@customreport.local',
    name: 'Olga N.',
    role: 'lead',
    samlId: 'lead-olga',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000016',
    email: 'sergey@customreport.local',
    name: 'Sergey T.',
    role: 'lead',
    samlId: 'lead-sergey',
  },
] as const;

export const LEAD_IDS = SEED_USERS.filter((u) => u.role === 'lead').map((u) => u.id);

// Convenience lead ID lookups (named for clarity in seed.ts)
export const LEAD_POLENKOV_ID = 'a0000000-0000-4000-8000-000000000011';
export const LEAD_MARIA_ID = 'a0000000-0000-4000-8000-000000000012';
export const LEAD_IGOR_ID = 'a0000000-0000-4000-8000-000000000013';
export const LEAD_DMITRY_ID = 'a0000000-0000-4000-8000-000000000014';
export const LEAD_OLGA_ID = 'a0000000-0000-4000-8000-000000000015';
export const LEAD_SERGEY_ID = 'a0000000-0000-4000-8000-000000000016';

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
export const SEED_PRODUCTS: readonly SeedProduct[] = [
  { id: 'a0000000-0000-4000-8000-000000000201', name: 'CRM Platform', leadId: LEAD_POLENKOV_ID },
  { id: 'a0000000-0000-4000-8000-000000000202', name: 'Data Analytics Suite', leadId: LEAD_POLENKOV_ID },
  { id: 'a0000000-0000-4000-8000-000000000203', name: 'Mobile Banking App', leadId: LEAD_MARIA_ID },
  { id: 'a0000000-0000-4000-8000-000000000204', name: 'E-Commerce Platform', leadId: LEAD_MARIA_ID },
  { id: 'a0000000-0000-4000-8000-000000000205', name: 'Cloud Infrastructure', leadId: LEAD_IGOR_ID },
  { id: 'a0000000-0000-4000-8000-000000000206', name: 'AI/ML Pipeline', leadId: LEAD_IGOR_ID },
  { id: 'a0000000-0000-4000-8000-000000000207', name: 'DevOps Toolkit', leadId: LEAD_DMITRY_ID },
  { id: 'a0000000-0000-4000-8000-000000000208', name: 'Security Gateway', leadId: LEAD_DMITRY_ID },
  { id: 'a0000000-0000-4000-8000-000000000209', name: 'Payment Processing', leadId: LEAD_OLGA_ID },
  { id: 'a0000000-0000-4000-8000-00000000020a', name: 'Partner Portal', leadId: LEAD_OLGA_ID },
  { id: 'a0000000-0000-4000-8000-00000000020b', name: 'HR Management System', leadId: LEAD_SERGEY_ID },
  { id: 'a0000000-0000-4000-8000-00000000020c', name: 'Inventory Tracker', leadId: LEAD_SERGEY_ID },
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
  { id: 'a0000000-0000-4000-8000-000000000701', name: 'Planning', sortOrder: 0 },
  { id: 'a0000000-0000-4000-8000-000000000702', name: 'Analysis', sortOrder: 1 },
  { id: 'a0000000-0000-4000-8000-000000000703', name: 'Design', sortOrder: 2 },
  { id: 'a0000000-0000-4000-8000-000000000704', name: 'Development', sortOrder: 3 },
  { id: 'a0000000-0000-4000-8000-000000000705', name: 'Testing', sortOrder: 4 },
  { id: 'a0000000-0000-4000-8000-000000000706', name: 'DevOps', sortOrder: 5 },
  { id: 'a0000000-0000-4000-8000-000000000707', name: 'Support', sortOrder: 6 },
] as const;

export type SeedReport = {
  id: string;
  periodStart: string;
  periodEnd: string;
  deadline: string;
  weekLabel: string;
  periodStatus: 'open' | 'published' | 'reopened';
  status: 'draft' | 'published';
  publishedAt?: string;
};

export const SEED_REPORTS = {
  active: {
    id: ACTIVE_REPORT_ID,
    periodStart: '2026-04-13T00:00:00.000Z',
    periodEnd: '2026-04-19T23:59:59.000Z',
    deadline: '2026-04-17T15:00:00.000Z',
    weekLabel: 'Week 16',
    periodStatus: 'open' as const,
    status: 'draft' as const,
  },
  published: {
    id: PUBLISHED_REPORT_ID,
    periodStart: '2026-04-06T00:00:00.000Z',
    periodEnd: '2026-04-12T23:59:59.000Z',
    deadline: '2026-04-10T15:00:00.000Z',
    weekLabel: 'Week 15',
    periodStatus: 'published' as const,
    status: 'published' as const,
    publishedAt: '2026-04-12T16:00:00.000Z',
  },
} as const;
