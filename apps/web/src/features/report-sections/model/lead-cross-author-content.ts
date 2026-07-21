/**
 * Cross-author CONTENT mappers for the lead form (Everyone state). Pure
 * functions; behavior is pinned by `lead-cross-author.test.ts`.
 *
 * `crossAuthorContent` (full content, fetched ONLY in the Everyone state)
 * carries the co-owners' item / risk / decision text + the owning author's
 * full name. This module reshapes those rows into the `Foreign*` presentation
 * types the lead form renders read-only alongside the author's own records.
 * The status-only stage-map mappers (always fetched) live in
 * `./lead-cross-author`.
 */

import type { DbRole, RiskSeverity } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import {
  applyBlockedRiskOverlay,
  type ItemStatus,
  workflowToItemStatus,
} from "./item-status";
import type {
  LeadDecisionEntry,
  LeadKanbanItem,
  LeadRiskEntry,
} from "./lead-form";

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
  authorRole?: DbRole;
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
    severity: RiskSeverity;
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
      severity: r.severity,
      text: r.risk,
    }));
    return ca.items
      .filter((i) => i.type === itemType)
      .map((i): ForeignKanbanItem => ({
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
        // Foreign (read-only) items never surface a priority control, and
        // the cross-author read model carries no paused metadata.
        priorityRank: null,
        pausedReason: null,
        authorId: ca.authorId,
        foreign: true,
      }));
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
    ca.risks.map((r): ForeignRiskEntry => ({
      id: `foreign:${ca.authorId}:${r.id}`,
      productId: r.projectId,
      productName: productNameById.get(r.projectId) ?? r.projectId,
      stageIds: r.stageNames,
      severity: r.severity,
      text: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      authorName: shortNameFromName(ca.authorName),
      authorId: ca.authorId,
      foreign: true,
    })),
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
    ca.decisions.map((d): ForeignDecisionEntry => ({
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
    })),
  );
}
