import type {
  DbRole,
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@weeklyreport/shared";

import type { SlideGridModel } from "./slide-grid-model";

export type SlideTone = "ready" | "warning" | "blocked" | "empty";

// The deck's owner line: a section author's DB role, the synthetic
// "product" owner of product-scoped slides, or null when the read model
// carries no author role.
type SlideOwnerRole = DbRole | "product" | null;

export interface SlideReadinessItem {
  readonly id: string;
  readonly label: string;
  readonly status: "ready" | "needs-work" | "optional";
  readonly detail: string;
  readonly required: boolean;
}

export type SlideStageStatus = TrafficLightStatus | null;

export interface SlideStage {
  readonly id: string;
  readonly name: string;
  readonly status: SlideStageStatus;
}

export interface SlideProduct {
  readonly id: string;
  readonly name: string;
  readonly status: SlideStageStatus;
  readonly stages: SlideStage[];
  readonly currentItems: string[];
  readonly nextItems: string[];
  readonly risks: string[];
  readonly decisions: string[];
  readonly priorities: string[];
  readonly itemRanks?: Readonly<Record<string, number>>;
}

export interface SectionSlideModel {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerRole: SlideOwnerRole;
  readonly status: ReportSectionReadModel["status"];
  readonly submittedAt: Date | null;
  readonly products: string[];
  readonly productSlides: SlideProduct[];
  readonly productCount: number;
  readonly currentCount: number;
  readonly nextCount: number;
  readonly riskCount: number;
  readonly decisionCount: number;
  readonly priorityCount: number;
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly score: number;
  readonly tone: SlideTone;
  readonly readiness: SlideReadinessItem[];
  readonly currentItems: string[];
  readonly nextItems: string[];
  readonly risks: string[];
  readonly decisions: string[];
  readonly priorities: string[];
  readonly pageIndex?: number;
  readonly pageTotal?: number;
  readonly pageLabel?: string;
  readonly grid?: SlideGridModel;
}
