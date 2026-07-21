/**
 * Cross-author STAGE-MAP mappers for the lead form (status-only read, ALWAYS
 * fetched). Pure functions; behavior is pinned by `lead-cross-author.test.ts`.
 *
 * Input types are structural mirrors of the `leadForm.crossAuthors` query
 * rows: this model layer must not import UI component types, so it
 * re-declares the row shape it consumes.
 *
 * `crossAuthors` gives, per shared product, the foreign stage names +
 * RISK-DERIVED traffic-light status + initials — no item/risk/decision text,
 * no full names. Drives `buildCrossAuthorStageMap` (foreign chips) and honest
 * health. The full-content mappers (`mapForeign*`, fetched ONLY in the
 * Everyone state) live in `./lead-cross-author-content`.
 */

import type { TrafficLightStatus } from "@customreport/shared";

import {
  type LeadProduct,
  normalizeStageName,
  stageNamesMatch,
} from "./lead-form";
import { type StageStatus, trafficToStageStatus } from "./traffic-light";

// ---- Structural input mirrors (query-row subsets) ----

/** Subset of one `leadForm.crossAuthors` row consumed by the stage map. */
export interface CrossAuthorRow {
  projectId: string;
  authorId: string;
  authorInitials: string;
  /** Short form «Кузнецова М.А.» for the cross-author stage label (ADR 0006). */
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

// ---- Mappers ----

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
      // ADR 0006: the cross-author STAGE label shows the short form, not the
      // two-letter mark (which stays for avatars / micro-chips).
      stageMap.set(norm, { assignee: ca.authorShortName, status });
    }
  }
  return map;
}

/**
 * unassigned-stage-reporting-exclusion: fill the real cross-author
 * assignee + derived status onto foreign-owned (`locked`) stages. Since the
 * "unassigned" category is gone, `buildStageGrid` now emits foreign-owned
 * stages as `locked` with `assignee: null` directly; this resolves who holds
 * each one and its status from the cross-author query. Stages the current user
 * owns (`mine`) are never touched, and a locked stage with no cross-author
 * entry keeps its null assignee.
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
