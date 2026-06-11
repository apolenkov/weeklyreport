/**
 * Snapshot mappers for the lead form (refactor-lead-mappers slice).
 *
 * Extracted verbatim from the inline F3.4 derivation blocks in
 * `components/lead/lead-form.tsx` (snapshot stage map + overlay, `snap:*`
 * projections). Pure functions; behavior is pinned by
 * `lead-snapshot.test.ts` and the lead-form characterization suites.
 *
 * Invariant (lead-report-controls-integrity, design D4): in snapshot mode
 * with a null payload — still loading, or no data for the version — all
 * four projections return `[]`. They NEVER fall back to the current
 * draft, which would misrepresent historical state.
 */

import { deriveEffectiveStageStatus } from "../stage-status";
import { coerceWorkflowToItemStatus } from "./lead-cross-author";
import {
  type LeadDecisionEntry,
  type LeadKanbanItem,
  type LeadProduct,
  type LeadRiskEntry,
  normalizeStageName,
} from "./lead-form";
import { type TrafficLightStatus, trafficToStageStatus } from "./traffic-light";

// ---- Structural input mirror ----

/**
 * Structural view of the `leadForm.getVersion` payload
 * (`VersionSnapshot.data` JSON). The mappers below consume only the
 * fields they project; unknown extra fields are ignored.
 */
export interface SnapPayload {
  stageStatuses?: {
    projectId: string;
    stageName: string;
    status: string;
  }[];
  items?: {
    projectId: string;
    type: string;
    text: string;
    workflowStatus: string;
    stageName?: string | null;
    priorityRank?: number | null;
  }[];
  risks?: {
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity?: string;
    stageName?: string | null;
  }[];
  decisions?: {
    productId?: string | null;
    text: string;
    owner: string;
    impact: string;
    deadline?: string | null;
    stageName?: string | null;
  }[];
}

// ---- Output types ----

export type SnapshotKanbanItem = LeadKanbanItem & {
  priorityRank: number | null;
};

interface SnapshotStageEntry {
  traffic: string;
  risks: { severity?: string }[];
  items: { workflowStatus: string }[];
}

/** projectId -> normalized stage name -> captured stage state. */
export type SnapshotStageMap = Map<string, Map<string, SnapshotStageEntry>>;

// ---- Mappers ----

/**
 * F3.4: build a lookup from snapshot stageStatuses + risks + items so
 * own-author stage chips reflect the status captured at snapshot time,
 * not the current draft. Risks/items attach only when their `stageName`
 * is present AND the stage entry exists; returns null for a null payload.
 */
export function buildSnapshotStageMap(
  payload: SnapPayload | null | undefined,
): SnapshotStageMap | null {
  if (!payload) return null;
  const map: SnapshotStageMap = new Map();
  for (const ss of payload.stageStatuses ?? []) {
    let pm = map.get(ss.projectId);
    if (!pm) {
      pm = new Map();
      map.set(ss.projectId, pm);
    }
    pm.set(normalizeStageName(ss.stageName), {
      traffic: ss.status,
      risks: [],
      items: [],
    });
  }
  for (const r of payload.risks ?? []) {
    if (!r.stageName) continue;
    const entry = map.get(r.projectId)?.get(normalizeStageName(r.stageName));
    if (entry) entry.risks.push({ severity: r.severity });
  }
  for (const item of payload.items ?? []) {
    if (!item.stageName) continue;
    const entry = map
      .get(item.projectId)
      ?.get(normalizeStageName(item.stageName));
    if (entry) entry.items.push({ workflowStatus: item.workflowStatus });
  }
  return map;
}

/**
 * F3.4: when viewing a historical snapshot, override own-author stage
 * statuses with snapshot values so chips reflect the captured state,
 * including risks/items. Skips `ownership === 'locked'` (cross-author)
 * stages; returns products untouched when the map is null.
 */
export function applySnapshotStageOverrides(
  products: LeadProduct[],
  snapshotStageMap: SnapshotStageMap | null,
): LeadProduct[] {
  if (!snapshotStageMap) return products;
  return products.map((p) => {
    const pm = snapshotStageMap.get(p.id);
    if (!pm) return p;
    return {
      ...p,
      stages: p.stages.map((s) => {
        if (s.ownership === "locked") return s;
        const snap = pm.get(normalizeStageName(s.stageName));
        if (!snap) return s;
        // snap.traffic is a raw Prisma TrafficLight value; map to StageStatus
        // first, then derive the effective status incorporating captured
        // risks and items.
        const explicit = trafficToStageStatus(
          snap.traffic as TrafficLightStatus | null,
        );
        return {
          ...s,
          status: deriveEffectiveStageStatus(explicit, snap.risks, snap.items),
        };
      }),
    };
  });
}

/**
 * F3.4: project snapshot items filtered by week type with positional
 * `snap:cw:`/`snap:nw:` ids. Null payload (or absent `items`) yields `[]`
 * — never the current draft (design D4).
 */
export function mapSnapshotItems(
  payload: SnapPayload | null | undefined,
  productNameById: ReadonlyMap<string, string>,
  authorName: string,
  itemType: "current" | "next",
): SnapshotKanbanItem[] {
  if (!payload?.items) return [];
  const idPrefix = itemType === "current" ? "snap:cw:" : "snap:nw:";
  return payload.items
    .filter((i) => i.type === itemType)
    .map(
      (i, idx): SnapshotKanbanItem => ({
        id: `${idPrefix}${idx}`,
        productId: i.projectId,
        productName: productNameById.get(i.projectId) ?? i.projectId,
        stageName: i.stageName ?? undefined,
        status: coerceWorkflowToItemStatus(i.workflowStatus),
        text: i.text,
        author: authorName,
        priorityRank: i.priorityRank ?? null,
      }),
    );
}

/**
 * F3.4: project snapshot risks with positional `snap:risk:` ids; severity
 * coerces to the binary union (non-`'blocked'` → `'at-risk'`). Null
 * payload yields `[]` (design D4).
 */
export function mapSnapshotRisks(
  payload: SnapPayload | null | undefined,
  productNameById: ReadonlyMap<string, string>,
): LeadRiskEntry[] {
  if (!payload?.risks) return [];
  return payload.risks.map(
    (r, idx): LeadRiskEntry => ({
      id: `snap:risk:${idx}`,
      productId: r.projectId,
      productName: productNameById.get(r.projectId) ?? r.projectId,
      stageName: r.stageName ?? undefined,
      severity: r.severity === "blocked" ? "blocked" : "at-risk",
      text: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
    }),
  );
}

/**
 * F3.4: project snapshot decisions with positional `snap:dec:` ids;
 * department-scoped decisions (no productId) keep empty product fields.
 * Null payload yields `[]` (design D4).
 */
export function mapSnapshotDecisions(
  payload: SnapPayload | null | undefined,
  productNameById: ReadonlyMap<string, string>,
): LeadDecisionEntry[] {
  if (!payload?.decisions) return [];
  return payload.decisions.map(
    (d, idx): LeadDecisionEntry => ({
      id: `snap:dec:${idx}`,
      productId: d.productId ?? "",
      productName: productNameById.get(d.productId ?? "") ?? "",
      text: d.text,
      owner: d.owner,
      impact: d.impact,
      deadline: d.deadline ?? null,
      stageName: d.stageName ?? undefined,
    }),
  );
}
