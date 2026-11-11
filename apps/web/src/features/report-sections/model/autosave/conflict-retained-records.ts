import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { sectionToDraftPayload } from "../lead-section-draft-payload";
import { encodeAutosaveComparisonKey } from "./autosave-stable-stringify";
import type { DraftSaveContent } from "./autosave-types";

type Risk = ReportSectionReadModel["risks"][number];
type Decision = ReportSectionReadModel["decisions"][number];
interface Identified {
  readonly stableId?: string | undefined;
}
interface RetainedRow<T> {
  readonly local: T;
  readonly fields: Partial<T>;
}

export interface RetainedDraftRecords {
  readonly risks: readonly RetainedRow<Risk>[];
  readonly decisions: readonly RetainedRow<Decision>[];
}

function changedFields<T>(
  current: T,
  base: T | undefined,
  fields: readonly (keyof T)[],
): Partial<T> {
  const changed: Partial<T> = {};
  for (const field of fields) {
    if (
      !base ||
      encodeAutosaveComparisonKey(current[field]) !==
        encodeAutosaveComparisonKey(base[field])
    ) {
      changed[field] = current[field];
    }
  }
  return changed;
}

function previouslyChangedFields<T>(
  current: T,
  retained: RetainedRow<T> | undefined,
  fields: readonly (keyof T)[],
): Partial<T> {
  const changes: Partial<T> = {};
  if (!retained) return changes;
  for (const field of fields)
    if (Object.hasOwn(retained.fields, field)) changes[field] = current[field];
  return changes;
}

function captureRows<T extends Identified>(
  current: readonly T[],
  base: readonly T[],
  attempted: readonly T[],
  policy: {
    readonly fields: readonly (keyof T)[];
    readonly context: readonly (keyof T)[];
    readonly unfinished: (row: T) => boolean;
    readonly retained?: readonly RetainedRow<T>[] | undefined;
  },
): readonly RetainedRow<T>[] {
  const baseById = new Map(base.map((row) => [row.stableId, row]));
  const attemptedById = new Map(attempted.map((row) => [row.stableId, row]));
  const retainedById = new Map(
    policy.retained?.map((row) => [row.local.stableId, row]),
  );
  const unfinishedAttempts = new Set(
    attempted.filter(policy.unfinished).map((row) => row.stableId),
  );
  return current.flatMap((local) => {
    if (!local.stableId) return [];
    const previous = baseById.get(local.stableId);
    if (
      !policy.unfinished(local) &&
      (!previous || !policy.unfinished(previous)) &&
      !unfinishedAttempts.has(local.stableId) &&
      !retainedById.has(local.stableId)
    )
      return [];
    const fields = [...policy.fields, ...policy.context];
    const changes = {
      ...changedFields(local, previous, fields),
      ...changedFields(
        local,
        attemptedById.get(local.stableId) ?? previous,
        fields,
      ),
      ...previouslyChangedFields(
        local,
        retainedById.get(local.stableId),
        fields,
      ),
    };
    // Parent and stages describe one context; a field-wise merge could invent
    // two parents or attach locally selected stages to the server's Activity.
    if (policy.context.some((field) => Object.hasOwn(changes, field))) {
      for (const field of policy.context) changes[field] = local[field];
    }
    return Object.keys(changes).length > 0 ? [{ local, fields: changes }] : [];
  });
}

// The canonical payload producer emits strings/null and Date/null here. Keep
// the form's blank controls while retaining the original parent and lineage.
function formRecords(payload: DraftSaveContent) {
  const risks: Risk[] = payload.risks.map((row) => ({
    ...row,
    impact: typeof row.impact === "string" ? row.impact : "",
    mitigation: typeof row.mitigation === "string" ? row.mitigation : "",
    stageNames: row.stageNames ?? [],
  }));
  const decisions: Decision[] = payload.decisions.map((row) => ({
    ...row,
    impact: typeof row.impact === "string" ? row.impact : "",
    deadline: row.deadline instanceof Date ? row.deadline : null,
    resolvedAt: row.resolvedAt instanceof Date ? row.resolvedAt : null,
    stageNames: row.stageNames ?? [],
  }));
  return { risks, decisions };
}

export function captureUnfinishedRecords(
  payload: DraftSaveContent,
  base: ReportSectionReadModel,
  attemptedPayload: DraftSaveContent,
  retained?: RetainedDraftRecords,
): RetainedDraftRecords {
  const current = formRecords(payload);
  const baseline = formRecords(sectionToDraftPayload(base));
  const attempted = formRecords(attemptedPayload);
  return {
    risks: captureRows(current.risks, baseline.risks, attempted.risks, {
      retained: retained?.risks,
      fields: ["risk", "impact", "mitigation", "severity"],
      context: ["projectId", "activityId", "stageNames"],
      unfinished: (row) => !row.impact.trim() || !row.mitigation.trim(),
    }),
    decisions: captureRows(
      current.decisions,
      baseline.decisions,
      attempted.decisions,
      {
        retained: retained?.decisions,
        fields: ["text", "impact", "owner", "deadline", "resolvedAt"],
        context: ["productId", "activityId", "stageNames"],
        unfinished: (row) => !row.impact.trim(),
      },
    ),
  };
}

function overlayRows<T extends Identified>(
  current: readonly T[],
  retained: readonly RetainedRow<T>[],
): readonly T[] {
  if (retained.length === 0) return current;
  const byId = new Map(retained.map((row) => [row.local.stableId, row]));
  const present = new Set(current.map((row) => row.stableId));
  return [
    ...current.map((row) => {
      const edit = byId.get(row.stableId);
      return edit ? { ...row, ...edit.fields } : row;
    }),
    ...retained
      .filter((row) => !present.has(row.local.stableId))
      .map((row) => row.local),
  ];
}

export function overlayUnfinishedRecords(
  section: ReportSectionReadModel,
  retained: RetainedDraftRecords,
): ReportSectionReadModel {
  return {
    ...section,
    risks: overlayRows(section.risks, retained.risks),
    decisions: overlayRows(section.decisions, retained.decisions),
  };
}
