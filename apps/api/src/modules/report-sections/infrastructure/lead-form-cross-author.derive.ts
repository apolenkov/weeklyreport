import type { TrafficLightStatus } from "@customreport/shared";
import { shortNameFromName, stageNamesMatch } from "@customreport/shared";

import type { CrossAuthorStatusRow } from "../domain/lead-form-shared";
import { initialsFromName } from "../domain/lead-form-shared";
import { indexNonNullStageStatuses } from "./non-null-stage-status-index.derive.js";

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
  * @param stageName - The stageName argument.
 * @param projectId - The projectId argument.
 * @param risks - The risks argument.
 * @param persisted - The persisted argument.
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
      // Empty stageNames = covers-all; without this covers-all risks colour nothing.
      (r.stageNames.length === 0 ||
        r.stageNames.some((name) => stageNamesMatch(name, stageName))),
  );
  if (covering.some((r) => r.severity === "blocked")) return "red";
  if (covering.length > 0) return "yellow";
  // No covering risk: the stage is on-track if it was touched at all,
  // otherwise empty. The persisted traffic value itself never colours.
  return persisted === null ? null : "green";
}

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
 * Index Foreign Sections.
 * @param sections - The sections argument.
 */
export function indexForeignSections(
  sections: readonly ForeignStatusSection[],
): {
  statusMap: Map<string, TrafficLightStatus>;
  risksByAuthor: Map<string, ForeignRisk[]>;
} {
  const statusMap = indexNonNullStageStatuses(
    sections.flatMap((section) =>
      section.stageStatuses.map((status) => ({
        ...status,
        authorId: section.authorId,
      })),
    ),
    (status) => `${status.authorId}::${status.projectId}::${status.stageId}`,
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

/**
 * Build Cross Author Status Rows.
 * @param others - The others argument.
 * @param statusMap - The statusMap argument.
 * @param risksByAuthor - The risksByAuthor argument.
 */
export function buildCrossAuthorStatusRows(
  others: readonly ForeignAssignmentRow[],
  statusMap: ReadonlyMap<string, TrafficLightStatus>,
  risksByAuthor: ReadonlyMap<string, ForeignRisk[]>,
): CrossAuthorStatusRow[] {
  const withStatus = others
    .filter((row) => !row.project.archived)
    .map((row) => {
      const persisted =
        statusMap.get(`${row.user.id}::${row.projectId}::${row.stageId}`) ??
        null;
      const status = deriveForeignStageStatus(
        row.stage.name,
        row.projectId,
        risksByAuthor.get(row.user.id) ?? [],
        persisted,
      );
      return { row, stageEntry: { stageName: row.stage.name, status } };
    });

  return [
    ...Map.groupBy(withStatus, ({ row }) => `${row.projectId}::${row.user.id}`),
  ].flatMap(([, group]) => {
    const [head] = group;
    if (!head) return [];
    const stageEntries = group.map((entry) => entry.stageEntry);
    return [
      {
        projectId: head.row.projectId,
        projectName: head.row.project.name,
        authorId: head.row.user.id,
        // Server-side initials + short name only — full name never leaves.
        authorInitials: initialsFromName(head.row.user.name),
        authorShortName: shortNameFromName(head.row.user.name),
        stageNames: [...new Set(stageEntries.map((e) => e.stageName))],
        stages: stageEntries,
      },
    ];
  });
}
