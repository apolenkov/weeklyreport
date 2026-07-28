/**
 * Maps the always-fetched, status-only cross-author rows used by the lead
 * form. The structural input mirrors the query result so this model layer
 * stays independent of UI component types. Full foreign content is handled
 * separately and fetched only for the Everyone view.
 */

import type { TrafficLightStatus } from "@customreport/shared";

import {
  type LeadProduct,
  normalizeStageName,
  stageNamesMatch,
} from "./lead-form";
import { type StageStatus, trafficToStageStatus } from "./traffic-light";

/** Subset of one `leadForm.crossAuthors` row consumed by the stage map. */
export interface CrossAuthorRow {
  projectId: string;
  authorId: string;
  authorInitials: string;
  /** Short form such as «Каштанова М.А.» for the stage label. */
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

/** projectId -> normalized stage name -> cross-author override. */
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

/**
 * Build a projectId → normalized-stage-name → { assignee, status } lookup
 * from `crossAuthors` rows only. Stage status is taken DIRECTLY from
 * `ca.stages[].status`, which the server already risk-derived
 * (deriveForeignStageStatus). Re-running the client `deriveEffectiveStageStatus`
 * here with empty risks/items would collapse a server `red`/`yellow` back to
 * on-track (the no-backing-risk path), making the foreign chip green while
 * product health reads red — so we trust the server value as-is.
 */
export function buildCrossAuthorStageMap(
  crossAuthors: readonly CrossAuthorRow[],
): CrossAuthorStageMap {
  const map: CrossAuthorStageMap = new Map();
  for (const ca of crossAuthors) {
    const stageMap = getOrCreateStageMap(map, ca.projectId);
    for (const sn of ca.stageNames) {
      const norm = normalizeStageName(sn);
      const stageEntry = ca.stages.find((s) =>
        stageNamesMatch(s.stageName, sn),
      );
      const status = trafficToStageStatus(stageEntry?.status ?? null);
      // Stage labels need the recognizable short name; the two-letter mark is
      // reserved for avatars and space-constrained chips.
      stageMap.set(norm, { assignee: ca.authorShortName, status });
    }
  }
  return map;
}

/**
 * Fill the real assignee and derived status onto foreign-owned (`locked`)
 * stages. `buildStageGrid` initially emits those stages with no assignee;
 * this resolves ownership from the cross-author query. Stages owned by the
 * current user are untouched, and unresolved locked stages remain anonymous.
 */
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
        const entry = stageMap.get(normalizeStageName(stage.stageName));
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
