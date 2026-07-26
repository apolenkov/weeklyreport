// Tier dataset shapes for the demo seed — plain data, consumed by one shared
// writer (`seed-demo.ts`). No Prisma calls live here.

import type {
  ItemType,
  ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import type { SEED_STAGES } from "./seed-constants.js";

export type StageName = (typeof SEED_STAGES)[number]["name"];
export type Tier = "small" | "huge";

export interface DemoLead {
  id: string;
  email: string;
  name: string;
  samlId: string;
}

export interface DemoProduct {
  id: string;
  name: string;
  leadId: string;
}

export interface DemoItem {
  type: ItemType;
  text: string;
  tag: string;
  status: ItemWorkflowStatus;
  stages: StageName[];
  priorityRank?: number;
}

export interface DemoRisk {
  risk: string;
  impact: string;
  mitigation: string;
  severity: "blocked" | "at-risk";
  stage: StageName;
}

export interface DemoDecision {
  text: string;
  impact: string;
  stage: StageName;
}

/** One owning lead's active-period section on one product. */
export interface DemoSection {
  leadId: string;
  leadLabel: string;
  productId: string;
  productLight: TrafficLightStatus;
  sectionStatus: ReportSectionStatus;
  ownedStages: StageName[];
  items: DemoItem[];
  risk?: DemoRisk;
  decision?: DemoDecision;
}

export interface TierDataset {
  leads: DemoLead[];
  products: DemoProduct[];
  sections: DemoSection[];
}
