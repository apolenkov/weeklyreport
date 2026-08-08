import type { ReportSectionStatus } from "@prisma/client";
import { ReportSectionStatus as SectionStatus } from "@prisma/client";

import type { SeedProduct } from "../support/seed-constants.js";
import {
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_PRODUCTS,
} from "../support/seed-constants.js";
import {
  LEAD_SLOT_DMITRY,
  LEAD_SLOT_IGOR,
  LEAD_SLOT_MARIA,
  LEAD_SLOT_OLGA,
  LEAD_SLOT_PRIMARY,
} from "./seed-advanced.anchors.js";
import { activeOffset } from "./seed-advanced.period.js";

export interface LeadConfig {
  readonly leadId: string;
  readonly leadIndex: number;
  readonly status: ReportSectionStatus;
  readonly submittedAt: Date | null;
  readonly products: readonly SeedProduct[];
}

const LEAD_SLOT_SERGEY = 6;

// Days after the period's Monday, and the times of day the submissions land on.
const TUESDAY = 1;
const WEDNESDAY = 2;
const THURSDAY = 3;
const MORNING_UTC = 10;
const EARLY_MORNING_UTC = 9;
const LATE_MORNING_UTC = 11;
const AFTERNOON_UTC = 14;
const HALF_PAST = 30;
const QUARTER_PAST = 15;

const productsByLead = (id: string): readonly SeedProduct[] =>
  SEED_PRODUCTS.filter((p) => p.leadId === id);

// Section status plan for the active period: 4 submitted, 6 total. Olga is a
// real draft with items; Sergey is empty on purpose so the dashboard's
// "pending" KPI has a non-zero bucket (his section shows 'pending').
export const ACTIVE_LEAD_CONFIGS: readonly LeadConfig[] = [
  {
    leadId: LEAD_1_ID,
    leadIndex: LEAD_SLOT_PRIMARY,
    status: SectionStatus.submitted,
    submittedAt: activeOffset(TUESDAY, MORNING_UTC),
    products: productsByLead(LEAD_1_ID),
  },
  {
    leadId: LEAD_MARIA_ID,
    leadIndex: LEAD_SLOT_MARIA,
    status: SectionStatus.submitted,
    submittedAt: activeOffset(TUESDAY, AFTERNOON_UTC),
    products: productsByLead(LEAD_MARIA_ID),
  },
  {
    leadId: LEAD_IGOR_ID,
    leadIndex: LEAD_SLOT_IGOR,
    status: SectionStatus.submitted,
    submittedAt: activeOffset(WEDNESDAY, EARLY_MORNING_UTC, HALF_PAST),
    products: productsByLead(LEAD_IGOR_ID),
  },
  {
    leadId: LEAD_DMITRY_ID,
    leadIndex: LEAD_SLOT_DMITRY,
    status: SectionStatus.submitted,
    submittedAt: activeOffset(THURSDAY, LATE_MORNING_UTC, QUARTER_PAST),
    products: productsByLead(LEAD_DMITRY_ID),
  },
  {
    leadId: LEAD_OLGA_ID,
    leadIndex: LEAD_SLOT_OLGA,
    status: SectionStatus.draft,
    submittedAt: null,
    products: productsByLead(LEAD_OLGA_ID),
  },
  {
    leadId: LEAD_SERGEY_ID,
    leadIndex: LEAD_SLOT_SERGEY,
    status: SectionStatus.draft,
    submittedAt: null,
    products: productsByLead(LEAD_SERGEY_ID),
  },
];
