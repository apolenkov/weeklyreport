// Cross-author content mappers for the lead form Everyone state. Reshape
// co-owners' item/risk/decision text into Foreign* rows rendered read-only
// beside the author's own records. Status-only stage maps live in ./lead-cross-author.

import type { DbRole, RiskSeverity } from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import { toIsoDateString } from "../../../lib/format-date";
import {
  applyBlockedRiskOverlay,
  type ItemWorkflowStatus,
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
    workflowStatus: ItemWorkflowStatus;
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

function requireProductName(
  productNameById: ReadonlyMap<string, string>,
  productId: string,
): string {
  const name = productNameById.get(productId);
  if (name === undefined) {
    throw new Error(`Cross-author product ${productId} has no display name.`);
  }
  return name;
}

// Everyone state: foreign kanban items by week type; ids use foreign:<author>:<id>.
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
        productName: requireProductName(productNameById, i.projectId),
        stageIds: i.stageNames,
        status: applyBlockedRiskOverlay(
          workflowToItemStatus(i.workflowStatus),
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
export function mapForeignRisks(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
): ForeignRiskEntry[] {
  return rows.flatMap((ca) =>
    ca.risks.map((r): ForeignRiskEntry => ({
      id: `foreign:${ca.authorId}:${r.id}`,
      productId: r.projectId,
      productName: requireProductName(productNameById, r.projectId),
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
export function mapForeignDecisions(
  rows: readonly CrossAuthorContentRow[],
  productNameById: ReadonlyMap<string, string>,
): ForeignDecisionEntry[] {
  return rows.flatMap((ca) =>
    ca.decisions.map((d): ForeignDecisionEntry => ({
      id: `foreign:${ca.authorId}:${d.id}`,
      productId: d.productId,
      productName: requireProductName(productNameById, d.productId),
      text: d.text,
      owner: d.owner,
      impact: d.impact,
      deadline: d.deadline ? toIsoDateString(d.deadline) : null,
      stageIds: d.stageNames,
      authorId: ca.authorId,
      foreign: true,
    })),
  );
}
