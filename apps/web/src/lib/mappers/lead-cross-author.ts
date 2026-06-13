/**
 * Cross-author mappers for the lead form (refactor-lead-mappers slice).
 *
 * Extracted verbatim from the inline derivation blocks in
 * `components/lead/lead-form.tsx` (F8 stage-map build + overlay, W5/W6
 * foreign projections). Pure functions; behavior is pinned by
 * `lead-cross-author.test.ts` and the lead-form characterization suites.
 *
 * Input types are structural mirrors of the `leadForm.crossAuthors` /
 * `leadForm.crossAuthorSections` query rows — `lib/mappers` must not import
 * component types (`components/lead/mock-data.ts`); see design D2.
 */

import { deriveEffectiveStageStatus } from "../stage-status";
import { type ItemStatus, workflowToItemStatus } from "./item-status";
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
  authorName: string;
  stageNames: readonly string[];
  stages: readonly {
    stageName: string;
    status: TrafficLightStatus | null;
  }[];
}

/** Subset of one `leadForm.crossAuthorSections` row consumed by the mappers. */
export interface CrossAuthorSection {
  authorId: string;
  authorName: string;
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

// ---- Helpers ----

/** Length of the `yyyy-mm-dd` prefix of an ISO-8601 timestamp. */
const ISO_DATE_PREFIX_LENGTH = 10;

/**
 * Lenient workflow→ItemStatus coercion (design D3). The cross-author and
 * snapshot rows carry `workflowStatus` as a plain string; the known enum
 * values delegate to the tested `workflowToItemStatus`, anything else
 * falls back to `'planned'`. The fallback is load-bearing — substituting
 * the strict mapper would be a silent behavior change.
 */
export function coerceWorkflowToItemStatus(ws: string): ItemStatus {
  if (ws === "done" || ws === "in_progress" || ws === "blocked") {
    return workflowToItemStatus(ws);
  }
  return "planned";
}

// ---- Mappers ----

/**
 * F8: join `crossAuthors` × `crossAuthorSections` by authorId into a
 * projectId → normalized-stage-name → { assignee, status } lookup.
 * Risk severity and blocked items of the foreign author feed the stage
 * chip color via `deriveEffectiveStageStatus`.
 */
export function buildCrossAuthorStageMap(
  crossAuthors: readonly CrossAuthorRow[],
  crossAuthorSections: readonly CrossAuthorSection[],
): CrossAuthorStageMap {
  const map: CrossAuthorStageMap = new Map();
  const sectionByAuthorId = new Map(
    crossAuthorSections.map((s) => [s.authorId, s] as const),
  );
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
      const caSection = sectionByAuthorId.get(ca.authorId);
      const stageRisks = (caSection?.risks ?? []).filter(
        (r) =>
          r.projectId === ca.projectId &&
          r.stageNames.some((n) => normalizeStageName(n) === norm),
      );
      const stageItems = (caSection?.items ?? []).filter(
        (i) =>
          i.projectId === ca.projectId &&
          i.stageNames.some((n) => normalizeStageName(n) === norm),
      );
      const status = deriveEffectiveStageStatus(
        trafficToStageStatus(stageEntry?.status ?? null),
        stageRisks,
        stageItems,
      );
      stageMap.set(norm, { assignee: ca.authorName, status });
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

/**
 * W5/W6: project foreign-author kanban items (read-only) filtered by week
 * type. Ids follow the `foreign:<authorId>:<itemId>` scheme; product name
 * falls back to the raw projectId when the lookup misses.
 */
export function mapForeignItems(
  sections: readonly CrossAuthorSection[],
  productNameById: ReadonlyMap<string, string>,
  itemType: "current" | "next",
): ForeignKanbanItem[] {
  return sections.flatMap((ca) =>
    ca.items
      .filter((i) => i.type === itemType)
      .map(
        (i): ForeignKanbanItem => ({
          id: `foreign:${ca.authorId}:${i.id}`,
          productId: i.projectId,
          productName: productNameById.get(i.projectId) ?? i.projectId,
          stageIds: i.stageNames,
          status: coerceWorkflowToItemStatus(i.workflowStatus),
          text: i.text,
          author: ca.authorName,
          authorId: ca.authorId,
          foreign: true,
        }),
      ),
  );
}

/**
 * W5/W6: project foreign-author risks. Severity is coerced to the binary
 * presentation union: everything non-`'blocked'` renders as `'at-risk'`.
 */
export function mapForeignRisks(
  sections: readonly CrossAuthorSection[],
  productNameById: ReadonlyMap<string, string>,
): ForeignRiskEntry[] {
  return sections.flatMap((ca) =>
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
        authorName: ca.authorName,
        authorId: ca.authorId,
        foreign: true,
      }),
    ),
  );
}

/**
 * W5/W6: project foreign-author decisions. `deadline` is formatted to the
 * `yyyy-mm-dd` ISO date prefix; null passes through.
 */
export function mapForeignDecisions(
  sections: readonly CrossAuthorSection[],
  productNameById: ReadonlyMap<string, string>,
): ForeignDecisionEntry[] {
  return sections.flatMap((ca) =>
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
