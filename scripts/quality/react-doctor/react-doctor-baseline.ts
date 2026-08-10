export interface ReactDoctorDiagnosticIdentity {
  readonly id: string;
  readonly file: string;
  readonly rule: string;
}

export interface ReactDoctorBaselineEntry extends ReactDoctorDiagnosticIdentity {
  readonly verdict: string;
  readonly rationale: string;
}

export interface ReactDoctorBaselineDiff {
  readonly duplicateBaselineIds: readonly string[];
  readonly duplicateCurrentIds: readonly string[];
  readonly added: readonly ReactDoctorDiagnosticIdentity[];
  readonly removed: readonly ReactDoctorBaselineEntry[];
  readonly metadataDrift: readonly ReactDoctorDiagnosticIdentity[];
  readonly invalidEntries: readonly ReactDoctorBaselineEntry[];
}

function duplicates(values: readonly string[]): readonly string[] {
  const counts = Map.groupBy(values, (value) => value);
  return [...counts]
    .filter(([, matches]) => matches.length > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right));
}

export function compareReactDoctorBaseline(
  baseline: readonly ReactDoctorBaselineEntry[],
  current: readonly ReactDoctorDiagnosticIdentity[],
): ReactDoctorBaselineDiff {
  const baselineById = new Map(baseline.map((entry) => [entry.id, entry]));
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const added = current.filter((entry) => !baselineById.has(entry.id));
  const removed = baseline.filter((entry) => !currentById.has(entry.id));
  const metadataDrift = current.filter((entry) => {
    const accepted = baselineById.get(entry.id);
    return (
      accepted !== undefined &&
      (accepted.file !== entry.file || accepted.rule !== entry.rule)
    );
  });
  const invalidEntries = baseline.filter(
    (entry) => entry.verdict !== "overturn" || entry.rationale.trim() === "",
  );

  return {
    duplicateBaselineIds: duplicates(baseline.map((entry) => entry.id)),
    duplicateCurrentIds: duplicates(current.map((entry) => entry.id)),
    added,
    removed,
    metadataDrift,
    invalidEntries,
  };
}

export function reactDoctorBaselineIsCurrent(
  diff: ReactDoctorBaselineDiff,
): boolean {
  return (
    diff.duplicateBaselineIds.length === 0 &&
    diff.duplicateCurrentIds.length === 0 &&
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.metadataDrift.length === 0 &&
    diff.invalidEntries.length === 0
  );
}
