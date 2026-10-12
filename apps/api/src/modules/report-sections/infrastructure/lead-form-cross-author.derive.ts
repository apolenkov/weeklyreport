import type { TrafficLightStatus } from "@customreport/shared";
import {
  initialsFromName,
  riskSeveritySchema,
  shortNameFromName,
} from "@customreport/shared";

import type { CrossAuthorStatusRow } from "../domain/lead-form-shared";
import { indexNonNullStageStatuses } from "./non-null-stage-status-index.derive.js";

// API traffic-light enum; null = no data / untouched stage.
export type StageTrafficStatus = TrafficLightStatus | null;

// A covering-risk projection: only severity + stageNames colour a stage.
interface ForeignRisk {
  // Nullable: an activity-parented risk carries no product FK and never matches
  // a `projectId`, so it colours no product stage.
  readonly projectId: string | null;
  readonly severity: string;
  readonly stageNames: string[];
}

// Mirrors the web stage derivation: only covering risks colour the stage.
export function deriveForeignStageStatus(
  stageName: string,
  projectId: string,
  risks: readonly ForeignRisk[],
  persisted: StageTrafficStatus,
): StageTrafficStatus {
  // The DB column is a plain String (Risk_severity_check CHECK backs the
  // two-value vocabulary); reject an unknown severity instead of silently
  // classifying it as at-risk.
  const covering = risks
    .map((r) => ({ ...r, severity: riskSeveritySchema.parse(r.severity) }))
    .filter(
      (r) => r.projectId === projectId && r.stageNames.includes(stageName),
    );
  if (covering.some((r) => r.severity === "blocked")) return "red";
  if (covering.length > 0) return "yellow";
  // No covering risk: the stage is on-track if it was touched at all,
  // otherwise empty. The persisted traffic value itself never colours.
  return persisted === null ? null : "green";
}

interface ForeignStatusSection {
  readonly authorId: string;
  readonly risks: readonly ForeignRisk[];
  readonly stageStatuses: readonly {
    projectId: string;
    stageId: string;
    status: StageTrafficStatus;
  }[];
}

export function indexForeignSections(
  sections: readonly ForeignStatusSection[],
): {
  statusMap: Map<string, TrafficLightStatus>;
  risksByAuthor: ReadonlyMap<string, readonly ForeignRisk[]>;
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
  const risksByAuthor = new Map<string, readonly ForeignRisk[]>(
    sections.map((s) => [s.authorId, s.risks] as const),
  );
  return { statusMap, risksByAuthor };
}

// Row of foreign stage assignments the status read groups over.
interface ForeignAssignmentRow {
  readonly projectId: string;
  readonly stageId: string;
  readonly project: { id: string; name: string; archived: boolean };
  readonly stage: { name: string };
  readonly user: { id: string; name: string };
}

export function buildCrossAuthorStatusRows(
  others: readonly ForeignAssignmentRow[],
  statusMap: ReadonlyMap<string, TrafficLightStatus>,
  risksByAuthor: ReadonlyMap<string, readonly ForeignRisk[]>,
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
