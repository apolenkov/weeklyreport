import type { CoverageCell } from "../source/contracts.ts";

const MAX_FAILURE_SUMMARY_ENTRIES = 20;
const MAX_FAILURE_SUMMARY_LENGTH = 4096;
const MAX_FAILURE_ID_LENGTH = 120;
const MAX_FAILURE_REASON_LENGTH = 180;
const NAVIGATION_SCAFFOLD_REASON =
  "Navigation-only matrix scaffold; live-control lane must execute each DOM control";

export interface FailureSummaryEntry {
  readonly id: string;
  readonly reason: string;
}

type FailureCell =
  | Pick<
      CoverageCell,
      "cellId" | "verdict" | "action" | "controls" | "evidence"
    >
  | Readonly<{
      readonly cellId: string;
      readonly verdict: string;
      readonly reasons: readonly string[];
    }>;

const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

const isScaffoldControl = (
  cell: Extract<FailureCell, { readonly controls: readonly unknown[] }>,
  controlKey: string,
  actionResult: { readonly kind: string; readonly reason?: string },
): boolean =>
  "action" in cell &&
  actionResult.kind === "not-exercised" &&
  actionResult.reason === NAVIGATION_SCAFFOLD_REASON &&
  controlKey !== cell.action.controlKey;

const isFailureControl = (
  cell: Extract<FailureCell, { readonly controls: readonly unknown[] }>,
  control: Extract<CoverageCell["controls"][number], object>,
): boolean => {
  const { actionResult, controlKey, enabled } = control;
  if (actionResult.kind === "exercised") return actionResult.result === "fail";
  if (!enabled || isScaffoldControl(cell, controlKey, actionResult))
    return false;
  return "action" in cell && controlKey === cell.action.controlKey;
};

const failureReasonFor = (control: CoverageCell["controls"][number]): string =>
  control.actionResult.kind === "exercised"
    ? `${control.controlKey}: exercised action failed`
    : `${control.controlKey}: ${control.actionResult.reason}`;

const renderEntries = (
  entries: readonly FailureSummaryEntry[],
  total: number,
): string => {
  const rendered = entries
    .slice(0, MAX_FAILURE_SUMMARY_ENTRIES)
    .map(
      ({ id, reason }) =>
        `${truncate(id, MAX_FAILURE_ID_LENGTH)}: ${truncate(reason, MAX_FAILURE_REASON_LENGTH)}`,
    )
    .join(" | ");
  const omitted = total - entries.length;
  const suffix = omitted > 0 ? ` | … ${omitted} more` : "";
  return `${rendered}${suffix}`.slice(0, MAX_FAILURE_SUMMARY_LENGTH);
};

export const compactFailureSummary = (issues: readonly string[]): string =>
  renderEntries(
    issues.slice(0, MAX_FAILURE_SUMMARY_ENTRIES).map((reason, index) => ({
      id: `issue-${index + 1}`,
      reason,
    })),
    issues.length,
  );

const reasonsFor = (cell: FailureCell): readonly string[] =>
  "reasons" in cell
    ? cell.reasons
    : [
        ...cell.evidence.observations
          .filter(({ outcome }) => outcome === "fail")
          .map(({ observationId, message }) => `${observationId}: ${message}`),
        ...cell.controls
          .filter((control) => isFailureControl(cell, control))
          .map(failureReasonFor),
        ...cell.evidence.inapplicable.map(
          ({ dimension, reason }) => `${dimension}: ${reason}`,
        ),
      ];

export const compactFailedCellSummary = (
  cells: readonly FailureCell[],
): string => {
  const failed = cells.filter(({ verdict }) => verdict !== "pass");
  const entries = failed.slice(0, MAX_FAILURE_SUMMARY_ENTRIES).map((cell) => {
    const reasons = reasonsFor(cell);
    return {
      id: cell.cellId,
      reason: [
        `verdict=${cell.verdict}`,
        ...(reasons.length === 0 ? ["no failure reason recorded"] : reasons),
      ].join("; "),
    };
  });
  return renderEntries(entries, failed.length);
};
