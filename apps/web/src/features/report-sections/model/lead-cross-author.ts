// Keep the always-fetched status projection independent of UI types; full
// foreign content is a separate, Everyone-only read.

import type { TrafficLightStatus } from "@customreport/shared";

import { type LeadProduct } from "./lead-form";
import { type StageStatus, trafficToStageStatus } from "./traffic-light";

export interface CrossAuthorRow {
  projectId: string;
  authorId: string;
  authorInitials: string;
  // Short display name used in stage labels.
  authorShortName: string;
  stageNames: readonly string[];
  stages: readonly {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

interface CrossAuthorStageOverride {
  assignee: string;
  status: StageStatus;
}

export type CrossAuthorStageMap = Map<
  string,
  Map<string, CrossAuthorStageOverride>
>;

function getOrCreateStageMap(
  map: CrossAuthorStageMap,
  projectId: string,
): Map<string, CrossAuthorStageOverride> {
  const existing = map.get(projectId);
  if (existing) return existing;
  const created = new Map<string, CrossAuthorStageOverride>();
  map.set(projectId, created);
  return created;
}

// Trust the server-derived stage status; recomputing with empty client records
// would collapse a server alarm back to on-track and miscolor the foreign chip.
export function buildCrossAuthorStageMap(
  crossAuthors: readonly CrossAuthorRow[],
): CrossAuthorStageMap {
  const map: CrossAuthorStageMap = new Map();
  for (const ca of crossAuthors) {
    const stageMap = getOrCreateStageMap(map, ca.projectId);
    for (const stageName of ca.stageNames) {
      const stageEntry = ca.stages.find(
        (stage) => stage.stageName === stageName,
      );
      const status = trafficToStageStatus(stageEntry?.status ?? null);
      // Stage labels need the recognizable short name; the two-letter mark is
      // reserved for avatars and space-constrained chips.
      stageMap.set(stageName, { assignee: ca.authorShortName, status });
    }
  }
  return map;
}

// Resolve ownership on locked stages from the cross-author read; own stages
// and unresolved locks remain unchanged.
export function applyCrossAuthorStageOverrides(
  products: readonly LeadProduct[],
  stageOverrides: CrossAuthorStageMap,
): LeadProduct[] {
  return products.map((product) => {
    const stageMap = stageOverrides.get(product.id);
    if (!stageMap) return product;
    return {
      ...product,
      stages: product.stages.map((stage) => {
        if (stage.ownership !== "locked") return stage;
        const entry = stageMap.get(stage.stageName);
        if (!entry) return stage;
        return {
          ...stage,
          assignee: entry.assignee,
          status: entry.status,
        };
      }),
    };
  });
}
