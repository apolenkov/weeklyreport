// Cross-author content mappers for the lead form Everyone state. Reshape
// co-owners' item/risk/decision text into Foreign* rows rendered read-only
// beside the author's own records. Status-only stage maps live in ./lead-cross-author.

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

// Subset of one crossAuthorContent row: co-owners' full text + author name.
// Per-product stages are unused here — foreign chips come from the status-only read.
export interface CrossAuthorContentRow {
  authorId: string;
  authorName: string;
  // Access role for the slide legend; optional so older snapshots still parse.
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

// Known enums go through workflowToItemStatus; anything else falls back to
// 'planned'. The fallback is load-bearing — a strict mapper would change behavior.
/**
 * Coerce Workflow To Item Status.
 * @param ws - The ws argument.
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

// Everyone state: foreign kanban items by week type; ids use foreign:<author>:<id>.
/**
 * Map Foreign Items.
 * @param rows - The rows argument.
 * @param productNameById - The productNameById argument.
 * @param itemType - The itemType argument.
 */
export function mapForeignItems(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
  itemType: "current" | "next",
): ForeignKanbanItem[] {
  return rows.flatMap((ca) => {
    // Blocked derives from the author's own covering risks (same lead-card rule).
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
        // Foreign items never surface priority; cross-author has no paused metadata.
        priorityRank: null,
        pausedReason: null,
        authorId: ca.authorId,
        foreign: true,
      }));
  });
}

// Foreign risks: non-'blocked' severity renders as 'at-risk' presentation-side.
/**
 * Map Foreign Risks.
 * @param rows - The rows argument.
 * @param productNameById - The productNameById argument.
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

// Foreign decisions: deadline formatted to yyyy-mm-dd; null passes through.
/**
 * Map Foreign Decisions.
 * @param rows - The rows argument.
 * @param productNameById - The productNameById argument.
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
