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
  readonly authorId: string;
  readonly authorName: string;
  // Access role for the slide legend; optional so older snapshots still parse.
  readonly authorRole?: DbRole;
  readonly items: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly type: string;
    readonly text: string;
    readonly workflowStatus: ItemWorkflowStatus;
    readonly stageNames: readonly string[];
  }[];
  readonly risks: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly risk: string;
    readonly impact: string;
    readonly mitigation: string;
    readonly severity: RiskSeverity;
    readonly stageNames: readonly string[];
  }[];
  readonly decisions: readonly {
    readonly id: string;
    readonly productId: string;
    readonly text: string;
    readonly owner: string;
    readonly impact: string;
    readonly deadline: Date | null;
    readonly stageNames: readonly string[];
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
      stageNames: r.stageNames,
      severity: r.severity,
      text: r.risk,
    }));
    return ca.items
      .filter((i) => i.type === itemType)
      .map((i): ForeignKanbanItem => ({
        id: `foreign:${ca.authorId}:${i.id}`,
        parent: { kind: "product", id: i.projectId },
        productId: i.projectId,
        productName: requireProductName(productNameById, i.projectId),
        activityId: null,
        stageNames: i.stageNames,
        status: applyBlockedRiskOverlay(
          workflowToItemStatus(i.workflowStatus),
          { projectId: i.projectId, stageNames: i.stageNames },
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
      stageNames: r.stageNames,
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
      stageNames: d.stageNames,
      authorId: ca.authorId,
      foreign: true,
    })),
  );
}
