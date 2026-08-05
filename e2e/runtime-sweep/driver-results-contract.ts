import { z } from "zod";

import {
  candidateKindSchema,
  type CoverageCell,
  roleSchema,
  seedProfileSchema,
  sourceShaSchema,
} from "./contracts.ts";

const driverAssignmentCellSchema = z
  .object({
    cellId: z.string().min(1),
    catalogRoute: z.string().min(1),
    resolvedRoute: z.string().min(1),
    actionKey: z.string().min(1),
  })
  .strict();
const driverControlResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      cellId: z.string().min(1),
      controlKey: z.string().min(1),
      status: z.literal("covered"),
      result: z.enum(["pass", "fail"]),
      evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
    })
    .strict(),
  z
    .object({
      cellId: z.string().min(1),
      controlKey: z.string().min(1),
      status: z.literal("blocked"),
      evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
      reason: z.string().min(1),
    })
    .strict(),
]);
const driverCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    cellId: z.string().min(1),
    controlKey: z.string().min(1).optional(),
    kind: candidateKindSchema,
    summary: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
  })
  .strict();
const routeTimelineSchema = z
  .object({
    route: z.string().min(1),
    enteredAt: z.string().min(1),
    leftAt: z.string().min(1),
  })
  .strict();
const transcriptEvidenceSchema = z
  .object({
    status: z.literal("captured"),
    evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
  })
  .strict();
const driverReportSchema = z
  .object({
    provider: z.literal("native-codex"),
    model: z.literal("gpt-5.6-luna"),
    reasoning: z.literal("max"),
    attemptId: z.string().min(1),
    transcriptEvidence: transcriptEvidenceSchema,
    roleDriven: roleSchema,
    profile: seedProfileSchema,
    sourceSha: sourceShaSchema,
    assignedCells: z.array(driverAssignmentCellSchema).min(1).readonly(),
    routesVisited: z.number().int().nonnegative(),
    routesPlanned: z.number().int().nonnegative(),
    canary: z.object({ injected: z.boolean(), detected: z.boolean() }).strict(),
    timeline: z
      .object({
        startedAt: z.string().min(1),
        endedAt: z.string().min(1),
        routes: z.array(routeTimelineSchema).readonly(),
      })
      .strict(),
    controlResults: z.array(driverControlResultSchema).min(1).readonly(),
    candidates: z.array(driverCandidateSchema).readonly(),
  })
  .strict();

type DriverAssignmentCell = z.infer<typeof driverAssignmentCellSchema>;
export type AiDriverReport = z.infer<typeof driverReportSchema>;
export type AiDriverTranscriptEvidence = z.infer<
  typeof transcriptEvidenceSchema
>;
export const AI_DRIVER_METADATA = {
  provider: "native-codex",
  model: "gpt-5.6-luna",
  reasoning: "max",
} as const;
export interface DriverValidationInput {
  readonly sourceSha: string;
  readonly profile: z.infer<typeof seedProfileSchema>;
  readonly role: z.infer<typeof roleSchema>;
  readonly cells: readonly CoverageCell[];
}
export interface DriverMergeOptions extends DriverValidationInput {
  readonly reportText: string;
  readonly reportArchivePath: string;
  readonly capturedAt?: string;
}

export class DriverResultValidationError extends Error {
  override readonly name = "DriverResultValidationError";

  constructor(readonly issues: readonly string[]) {
    super(`AI driver result rejected: ${issues.join("; ")}`);
  }
}

const unique = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) === index);
const pair = (cellId: string, controlKey: string): string =>
  `${cellId}\u0000${controlKey}`;
const duplicateValues = (values: readonly string[]): readonly string[] =>
  unique(values.filter((value, index) => values.indexOf(value) !== index));
function expectedAssignments(
  input: DriverValidationInput,
): readonly DriverAssignmentCell[] {
  const issues = sourceShaSchema.safeParse(input.sourceSha).success
    ? []
    : ["campaign source SHA is malformed"];
  const cellIds = input.cells.map((cell) => cell.cellId);
  const duplicateCells = duplicateValues(cellIds);
  const metadataIssues = input.cells.flatMap((cell) => [
    ...(cell.sourceSha !== input.sourceSha
      ? [`${cell.cellId} has stale source SHA ${cell.sourceSha}`]
      : []),
    ...(cell.profile !== input.profile
      ? [`${cell.cellId} has stale profile ${cell.profile}`]
      : []),
    ...(cell.role !== input.role
      ? [`${cell.cellId} has stale role ${cell.role}`]
      : []),
  ]);
  const assignments = input.cells
    .toSorted((left, right) => left.cellId.localeCompare(right.cellId))
    .map((cell) => ({
      cellId: cell.cellId,
      catalogRoute: cell.catalogRoute,
      resolvedRoute: cell.resolvedRoute,
      actionKey: cell.action.controlKey,
    }));
  const allIssues = [
    ...issues,
    ...(input.cells.length === 0 ? ["no assigned coverage cells"] : []),
    ...duplicateCells.map((cellId) => `duplicate expected cell ${cellId}`),
    ...metadataIssues,
  ];
  if (allIssues.length > 0) throw new DriverResultValidationError(allIssues);
  return assignments;
}

function buildDriverAssignment(
  input: DriverValidationInput,
): readonly DriverAssignmentCell[] {
  return expectedAssignments(input);
}

export function renderDriverAssignment(input: DriverValidationInput): string {
  return JSON.stringify(buildDriverAssignment(input), null, 2);
}

function assignmentIssues(
  report: AiDriverReport,
  expected: readonly DriverAssignmentCell[],
): readonly string[] {
  const expectedById = new Map(expected.map((cell) => [cell.cellId, cell]));
  const actualIds = report.assignedCells.map((cell) => cell.cellId);
  const identityIssues = [
    ...duplicateValues(actualIds).map(
      (cellId) => `duplicate assigned cell ${cellId}`,
    ),
    ...expected
      .filter((cell) => !actualIds.includes(cell.cellId))
      .map((cell) => `missing assigned cell ${cell.cellId}`),
    ...report.assignedCells
      .filter((cell) => !expectedById.has(cell.cellId))
      .map((cell) => `unexpected assigned cell ${cell.cellId}`),
  ];
  const detailIssues = expected.flatMap((cell) => {
    const actual = report.assignedCells.find(
      (entry) => entry.cellId === cell.cellId,
    );
    if (!actual) return [];
    if (
      actual.catalogRoute !== cell.catalogRoute ||
      actual.resolvedRoute !== cell.resolvedRoute
    )
      return [`${cell.cellId} assigned route is stale`];
    return actual.actionKey === cell.actionKey
      ? []
      : [`${cell.cellId} assigned action key is stale`];
  });
  return [...identityIssues, ...detailIssues];
}

function controlIssues(
  report: AiDriverReport,
  expected: readonly DriverAssignmentCell[],
): readonly string[] {
  const expectedPairs = expected.map((cell) =>
    pair(cell.cellId, cell.actionKey),
  );
  const actualPairs = report.controlResults.map((result) =>
    pair(result.cellId, result.controlKey),
  );
  const expectedSet = new Set(expectedPairs);
  const actualSet = new Set(actualPairs);
  const unknown = unique(actualPairs.filter((key) => !expectedSet.has(key)));
  return [
    ...duplicateValues(actualPairs).map(
      (key) => `duplicate control result ${key}`,
    ),
    ...expectedPairs
      .filter((key) => !actualSet.has(key))
      .map((key) => `missing control result ${key}`),
    ...unknown.map((key) => `unexpected control result ${key}`),
  ];
}

export function validateDriverReport(
  report: AiDriverReport,
  input: DriverValidationInput,
): AiDriverReport {
  const expected = expectedAssignments(input);
  const expectedCells = new Map(expected.map((cell) => [cell.cellId, cell]));
  const metadataIssues = [
    ...(report.sourceSha !== input.sourceSha
      ? ["driver report source SHA is stale"]
      : []),
    ...(report.profile !== input.profile
      ? ["driver report profile is stale"]
      : []),
    ...(report.roleDriven !== input.role
      ? ["driver report role is stale"]
      : []),
    ...(report.routesPlanned !==
    unique(expected.map((cell) => cell.catalogRoute)).length
      ? ["driver report planned route count is stale"]
      : []),
    ...(report.routesVisited !== report.routesPlanned
      ? ["driver report did not visit every assigned route"]
      : []),
    ...(report.canary.injected && report.canary.detected
      ? []
      : ["driver console canary was not detected"]),
  ];
  const candidateIssues = report.candidates.flatMap((candidate) => {
    const cell = expectedCells.get(candidate.cellId);
    return [
      ...(cell
        ? []
        : [`candidate ${candidate.candidateId} references an unknown cell`]),
      ...(cell &&
      candidate.controlKey &&
      candidate.controlKey !== cell.actionKey
        ? [`candidate ${candidate.candidateId} references an unknown action`]
        : []),
    ];
  });
  const issues = [
    ...metadataIssues,
    ...assignmentIssues(report, expected),
    ...controlIssues(report, expected),
    ...candidateIssues,
  ];
  if (issues.length > 0) throw new DriverResultValidationError(issues);
  return report;
}

export function parseAiDriverReport(
  text: string,
  input: DriverValidationInput,
): AiDriverReport {
  const parsedJson: unknown = JSON.parse(text);
  const parsed = driverReportSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new DriverResultValidationError(
      parsed.error.issues.map((issue) => issue.message),
    );
  }
  return validateDriverReport(parsed.data, input);
}
