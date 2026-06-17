/**
 * Cross-author mappers for the lead form (refactor-lead-mappers slice).
 *
 * Extracted verbatim from the inline derivation blocks in
 * `components/lead/lead-form.tsx` (F8 stage-map build + overlay).
 * Pure functions; behavior is pinned by `lead-cross-author.test.ts` and the
 * lead-form characterization suites.
 *
 * Input types are structural mirrors of the `leadForm.crossAuthors` query
 * rows — `lib/mappers` must not import component types
 * (`components/lead/mock-data.ts`); see design D2.
 *
 * crossAuthorSections (foreign-content read) has been removed from this
 * module. Stage status is now RISK-DERIVED from ca.stages[].status only;
 * no foreign item/risk/decision text crosses the API boundary.
 */

import {
  type LeadProduct,
  normalizeStageName,
  stageNamesMatch,
} from "./lead-form";
import {
  type StageStatus,
  type TrafficLightStatus,
  trafficToStageStatus,
} from "./traffic-light";

// ---- Structural input mirrors (query-row subsets) ----

/** Subset of one `leadForm.crossAuthors` row consumed by the stage map. */
export interface CrossAuthorRow {
  projectId: string;
  authorId: string;
  authorInitials: string;
  stageNames: readonly string[];
  stages: readonly {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

export interface CrossAuthorStageOverride {
  assignee: string;
  status: StageStatus;
}

/** projectId -> normalized stage name -> cross-author override. */
export type CrossAuthorStageMap = Map<
  string,
  Map<string, CrossAuthorStageOverride>
>;

// ---- Mappers ----

/**
 * F8: build a projectId → normalized-stage-name → { assignee, status } lookup
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
    let stageMap = map.get(ca.projectId);
    if (!stageMap) {
      stageMap = new Map();
      map.set(ca.projectId, stageMap);
    }
    for (const sn of ca.stageNames) {
      const norm = normalizeStageName(sn);
      const stageEntry = ca.stages.find((s) =>
        stageNamesMatch(s.stageName, sn),
      );
      const status = trafficToStageStatus(stageEntry?.status ?? null);
      stageMap.set(norm, { assignee: ca.authorInitials, status });
    }
  }
  return map;
}

/**
 * F8: rewrite ONLY `ownership === 'unassigned'` stages to `'locked'` with
 * the cross-author assignee and derived status. Stages the current user
 * owns (or that are already locked) are never touched.
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
        if (stage.ownership !== "unassigned") return stage;
        const entry = stageMap.get(normalizeStageName(stage.stageName));
        if (!entry) return stage;
        return {
          ...stage,
          ownership: "locked" as const,
          assignee: entry.assignee,
          status: entry.status,
        };
      }),
    };
  });
}
