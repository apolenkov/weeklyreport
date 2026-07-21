import type { TrafficLightStatus } from "@customreport/shared";
import { shortNameFromName, stageNamesMatch } from "@customreport/shared";

import type { CrossAuthorStatusRow } from "../domain/lead-form-shared";
import { initialsFromName } from "../domain/lead-form-shared";

/** API traffic-light enum; null = no data / untouched stage. */
export type StageTrafficStatus = TrafficLightStatus | null;

/** A covering-risk projection: only severity + stageNames colour a stage. */
interface ForeignRisk {
  // Nullable: an activity-parented risk carries no product FK and never matches
  // a `projectId`, so it colours no product stage.
  projectId: string | null;
  severity: string;
  stageNames: string[];
}

/**
 * Risk-derived foreign stage status. Mirrors `deriveEffectiveStageStatus`
 * (apps/web/src/lib/stage-status.ts) with `items: []` — the foreign blocked-
 * item path is intentionally NOT consulted here.
 *
 * Precedence over covering risks (those whose `stageNames` name this stage,
 * Dev↔Development aliased): blocked → red, any other severity → yellow.
 * With no covering risk the persisted traffic is used only as the
 * empty/non-empty base — a persisted yellow/red with no backing risk
 * collapses to green; a null base stays null.
 */
export function deriveForeignStageStatus(
  stageName: string,
  projectId: string,
  risks: readonly ForeignRisk[],
  persisted: StageTrafficStatus,
): StageTrafficStatus {
  const covering = risks.filter(
    (r) =>
      r.projectId === projectId &&
      // An empty stageNames is the canonical "covers all assigned stages"
      // marker (mirrors riskCoversStage in stage-tags.ts and the Add-Risk
      // dialog default). Without this, a co-lead's covers-all blocked risk
      // would colour no foreign stage and product health would read green.
      (r.stageNames.length === 0 ||
        r.stageNames.some((name) => stageNamesMatch(name, stageName))),
  );
  if (covering.some((r) => r.severity === "blocked")) return "red";
  if (covering.length > 0) return "yellow";
  // No covering risk: the stage is on-track if it was touched at all,
  // otherwise empty. The persisted traffic value itself never colours.
  return persisted === null ? null : "green";
}

/** Foreign section shape for the status-only cross-author read. */
interface ForeignStatusSection {
  authorId: string;
  risks: ForeignRisk[];
  stageStatuses: {
    projectId: string;
    stageId: string;
    status: StageTrafficStatus;
  }[];
}

/**
 * Indexes foreign sections into the two lookups the status-row builder needs:
 * a persisted-traffic map keyed "authorId::projectId::stageId" (non-null only)
 * and the per-author covering risks. Reproduces the nested set-loop exactly.
 */
export function indexForeignSections(
  sections: readonly ForeignStatusSection[],
): {
  statusMap: Map<string, TrafficLightStatus>;
  risksByAuthor: Map<string, ForeignRisk[]>;
} {
  const statusMap = new Map<string, TrafficLightStatus>(
    sections.flatMap((s) =>
      s.stageStatuses.flatMap((ss) =>
        ss.status !== null
          ? ([[`${s.authorId}::${ss.projectId}::${ss.stageId}`, ss.status]] as [
              string,
              TrafficLightStatus,
            ][])
          : [],
      ),
    ),
  );
  const risksByAuthor = new Map<string, ForeignRisk[]>(
    sections.map((s) => [s.authorId, s.risks] as const),
  );
  return { statusMap, risksByAuthor };
}

/** Row of foreign stage assignments the status read groups over. */
interface ForeignAssignmentRow {
  projectId: string;
  stageId: string;
  project: { id: string; name: string; archived: boolean };
  stage: { name: string };
  user: { id: string; name: string };
}

interface StatusRowAccum {
  projectId: string;
  projectName: string;
  authorId: string;
  authorInitials: string;
  authorShortName: string;
  stageNames: Set<string>;
  stageEntries: { stageName: string; status: StageTrafficStatus }[];
}

/**
 * Groups foreign stage assignments by (projectId, authorId) into status rows,
 * preserving first-seen insertion order. Archived-project rows are dropped.
 * Each stage's status is risk-derived via {@link deriveForeignStageStatus}.
 */
export function buildCrossAuthorStatusRows(
  others: readonly ForeignAssignmentRow[],
  statusMap: ReadonlyMap<string, TrafficLightStatus>,
  risksByAuthor: ReadonlyMap<string, ForeignRisk[]>,
): CrossAuthorStatusRow[] {
  const grouped = others
    .filter((row) => !row.project.archived)
    .reduce<Map<string, StatusRowAccum>>((acc, row) => {
      const key = `${row.projectId}::${row.user.id}`;
      const persisted =
        statusMap.get(`${row.user.id}::${row.projectId}::${row.stageId}`) ??
        null;
      const stageStatus = deriveForeignStageStatus(
        row.stage.name,
        row.projectId,
        risksByAuthor.get(row.user.id) ?? [],
        persisted,
      );
      const stageEntry = { stageName: row.stage.name, status: stageStatus };
      const existing = acc.get(key);
      if (existing) {
        return new Map(acc).set(key, {
          ...existing,
          stageNames: new Set([...existing.stageNames, row.stage.name]),
          stageEntries: [...existing.stageEntries, stageEntry],
        });
      }
      return new Map(acc).set(key, {
        projectId: row.projectId,
        projectName: row.project.name,
        authorId: row.user.id,
        // Derive display forms server-side (ADR 0006): the two-letter mark for
        // avatars/micro-chips, and the SHORT form ("Кузнецова М.А.") for the
        // cross-author stage label. Only these leave the method — never the
        // full ФИО.
        authorInitials: initialsFromName(row.user.name),
        authorShortName: shortNameFromName(row.user.name),
        stageNames: new Set([row.stage.name]),
        stageEntries: [stageEntry],
      });
    }, new Map());

  return [...grouped.values()].map((g) => ({
    projectId: g.projectId,
    projectName: g.projectName,
    authorId: g.authorId,
    authorInitials: g.authorInitials,
    authorShortName: g.authorShortName,
    stageNames: [...g.stageNames],
    stages: g.stageEntries,
  }));
}
