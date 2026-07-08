/**
 * Cross-author mappers for the lead form. Pure functions; behavior is pinned by
 * `lead-cross-author.test.ts` and the lead-form characterization suites.
 *
 * Input types are structural mirrors of the `leadForm.crossAuthors` /
 * `leadForm.crossAuthorContent` query rows: this model layer must not import UI
 * component types, so it re-declares the row shapes it consumes.
 *
 * Two distinct reads feed this module:
 *   - `crossAuthors` (status-only, ALWAYS fetched): per shared product, the
 *     foreign stage names + RISK-DERIVED traffic-light status + initials.
 *     Drives `buildCrossAuthorStageMap` (foreign chips) and honest health.
 *     No item/risk/decision text; no full names.
 *   - `crossAuthorContent` (full content, fetched ONLY in the Everyone state):
 *     the co-owners' item / risk / decision text + the owning author's full
 *     name. Drives the `mapForeign*` content mappers below.
 */

import { shortNameFromName } from "@customreport/shared";

import {
  applyBlockedRiskOverlay,
  type ItemStatus,
  workflowToItemStatus,
} from "./item-status";
import {
  type LeadDecisionEntry,
  type LeadKanbanItem,
  type LeadProduct,
  type LeadRiskEntry,
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
  /** Short form «Кузнецова М.А.» for the cross-author stage label (ADR 0006). */
  authorShortName: string;
  stageNames: readonly string[];
  stages: readonly {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

/**
 * Subset of one `leadForm.crossAuthorContent` row consumed by the content
 * mappers. Structural mirror of the backend `CrossAuthorSectionRow`; carries
 * the co-owners' full item / risk / decision text + the owning author's full
 * name (the strictly-more-sensitive Everyone read). The per-product `stages[]`
 * are not consumed here — foreign chips come from the status-only read.
 */
export interface CrossAuthorContentRow {
  authorId: string;
  authorName: string;
  /** The author's access role — the slide legend labels every author with it.
   * Optional so frozen snapshots predating the field still parse. */
  authorRole?: "lead" | "head" | "admin" | "viewer";
  items: {
    id: string;
    projectId: string;
    type: string;
    text: string;
    workflowStatus: string;
    stageNames: string[];
  }[];
  risks: {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
  }[];
  decisions: {
    id: string;
    productId: string;
    text: string;
    owner: string;
    impact: string;
    deadline: Date | null;
    stageNames: string[];
  }[];
}

// ---- Output types (Lead* presentation extensions) ----

export type ForeignKanbanItem = LeadKanbanItem & {
  foreign: true;
  authorId: string;
};

export type ForeignRiskEntry = LeadRiskEntry & {
  foreign: true;
  authorId: string;
  authorName: string;
};

export type ForeignDecisionEntry = LeadDecisionEntry & {
  foreign: true;
  authorId: string;
};

export interface CrossAuthorStageOverride {
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

// ---- Foreign content mappers (Everyone state only) ----

/** Length of the `yyyy-mm-dd` prefix of an ISO-8601 timestamp. */
const ISO_DATE_PREFIX_LENGTH = 10;

/**
 * Lenient workflow→ItemStatus coercion. The cross-author content
 * rows carry `workflowStatus` as a plain string; the known enum values
 * delegate to the tested `workflowToItemStatus`, anything else falls back to
 * `'planned'`. The fallback is load-bearing — substituting the strict mapper
 * would be a silent behavior change.
 */
export function coerceWorkflowToItemStatus(ws: string): ItemStatus {
  if (
    ws === "done" ||
    ws === "in_progress" ||
    ws === "paused" ||
    ws === "postponed" ||
    ws === "planned"
  ) {
    return workflowToItemStatus(ws);
  }
  return "planned";
}

/**
 * Everyone state: project foreign-author kanban items (read-only) filtered by
 * week type. Ids follow the `foreign:<authorId>:<itemId>` scheme; product name
 * falls back to the raw projectId when the lookup misses.
 */
export function mapForeignItems(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
  itemType: "current" | "next",
): ForeignKanbanItem[] {
  return rows.flatMap((ca) => {
    // record-status-derived-from-risk: the foreign item's blocked derives from
    // the author's own covering risks (blocked-only overlay) — the SAME rule the
    // lead card applies — so a stored blocked never shows without a backing risk.
    const alarmRisks = ca.risks.map((r) => ({
      productId: r.projectId,
      stageIds: r.stageNames,
      severity:
        r.severity === "blocked" ? ("blocked" as const) : ("at-risk" as const),
      text: r.risk,
    }));
    return ca.items
      .filter((i) => i.type === itemType)
      .map(
        (i): ForeignKanbanItem => ({
          id: `foreign:${ca.authorId}:${i.id}`,
          productId: i.projectId,
          productName: productNameById.get(i.projectId) ?? i.projectId,
          stageIds: i.stageNames,
          status: applyBlockedRiskOverlay(
            coerceWorkflowToItemStatus(i.workflowStatus),
            { projectId: i.projectId, stageIds: i.stageNames },
            alarmRisks,
          ),
          text: i.text,
          author: shortNameFromName(ca.authorName),
          // Foreign (read-only) items never surface a priority control.
          priorityRank: null,
          authorId: ca.authorId,
          foreign: true,
        }),
      );
  });
}

/**
 * Everyone state: project foreign-author risks. Severity is coerced to the
 * binary presentation union: everything non-`'blocked'` renders as `'at-risk'`.
 */
export function mapForeignRisks(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
): ForeignRiskEntry[] {
  return rows.flatMap((ca) =>
    ca.risks.map(
      (r): ForeignRiskEntry => ({
        id: `foreign:${ca.authorId}:${r.id}`,
        productId: r.projectId,
        productName: productNameById.get(r.projectId) ?? r.projectId,
        stageIds: r.stageNames,
        severity: r.severity === "blocked" ? "blocked" : "at-risk",
        text: r.risk,
        impact: r.impact,
        mitigation: r.mitigation,
        authorName: shortNameFromName(ca.authorName),
        authorId: ca.authorId,
        foreign: true,
      }),
    ),
  );
}

/**
 * Everyone state: project foreign-author decisions. `deadline` is formatted to
 * the `yyyy-mm-dd` ISO date prefix; null passes through.
 */
export function mapForeignDecisions(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
): ForeignDecisionEntry[] {
  return rows.flatMap((ca) =>
    ca.decisions.map(
      (d): ForeignDecisionEntry => ({
        id: `foreign:${ca.authorId}:${d.id}`,
        productId: d.productId,
        productName: productNameById.get(d.productId) ?? d.productId,
        text: d.text,
        owner: d.owner,
        impact: d.impact,
        deadline: d.deadline
          ? d.deadline.toISOString().slice(0, ISO_DATE_PREFIX_LENGTH)
          : null,
        stageIds: d.stageNames,
        authorId: ca.authorId,
        foreign: true,
      }),
    ),
  );
}
