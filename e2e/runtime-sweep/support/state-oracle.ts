import type {
  DbRole,
  PeriodState,
  PeriodStatus,
  ReportStatus,
} from "@customreport/shared";

import type {
  LifecycleState,
  OwnershipDensity,
  PermissionBoundary,
  SubmissionState,
} from "../source/contracts.ts";

export type RequiredRole = DbRole | null;
// prettier-ignore
export type PeriodDualState = Readonly<{ status: ReportStatus; periodState: PeriodState; periodStatus: PeriodStatus; archived: boolean }>;
// prettier-ignore
export type LifecycleExpectation = Readonly<{ state: LifecycleState; period: PeriodDualState; editable: boolean; visibleToStatusObserver: boolean }>;
// prettier-ignore
export type SubmissionExpectation = Readonly<{ state: SubmissionState; sectionStatus: "draft" | "submitted"; submittedAt: "absent" | "present"; verdict: "none" | "approved" | "changes_requested"; editable: boolean }>;
// prettier-ignore
export type OwnershipExpectation = Readonly<{ density: OwnershipDensity; assignedStageCount: number; hasForeignOwner: boolean }>;
// prettier-ignore
export type PermissionExpectation = Readonly<{ boundary: PermissionBoundary; allowed: boolean; authenticated: boolean; requiredRole: RequiredRole; requiresOwnership: boolean }>;
// prettier-ignore
export type PeriodDualStateObservation = Readonly<{ matches: boolean; mismatches: readonly (keyof PeriodDualState)[] }>;
// prettier-ignore
export type RuntimeSectionState = Readonly<{ status: "draft" | "submitted"; submittedAt: "absent" | "present"; verdict: "none" | "approved" | "changes_requested" }>;
export type RuntimeSectionSnapshot = RuntimeSectionState &
  Readonly<{ version: number }>;
// prettier-ignore
export type RuntimeOwnershipState = Readonly<{ targetOwnerId: string; owners: readonly string[] }>;
// prettier-ignore
export type RuntimePermissionState = Readonly<{ actorId: string | null; actorRole: DbRole | null; authenticated: boolean; allowed: boolean; ownsTarget: boolean }>;
// prettier-ignore
export type RuntimeDatabaseSnapshot = Readonly<{ report: PeriodDualState; section: RuntimeSectionSnapshot; ownership: RuntimeOwnershipState; permission: RuntimePermissionState }>;
// prettier-ignore
export type RuntimeOracleMismatch = Readonly<{ axis: "lifecycle" | "submission" | "ownership" | "permission"; field: string; expected: string | number | boolean | null; actual: string | number | boolean | null }>;
// prettier-ignore
export type RuntimeOracleObservation = Readonly<{ matches: boolean; mismatches: readonly RuntimeOracleMismatch[] }>;
// prettier-ignore
export type RuntimeDomainOracle = Readonly<{ lifecycle: LifecycleExpectation; submission: SubmissionExpectation; ownership: OwnershipExpectation; permission: PermissionExpectation; key: string }>;
// prettier-ignore
type LifecycleRow = readonly [LifecycleState, ReportStatus, PeriodState, PeriodStatus, boolean, boolean, boolean];
const LIFECYCLE_ROWS: readonly LifecycleRow[] = [
  ["open", "draft", "open", "open", false, true, true],
  ["reopened", "published", "open", "reopened", false, true, true],
  ["published", "published", "published", "published", false, false, true],
  ["archived", "published", "archived", "published", true, false, true],
];

// prettier-ignore
type SubmissionRow = readonly [SubmissionState, "draft" | "submitted", "absent" | "present", "none" | "approved" | "changes_requested", boolean];
const SUBMISSION_ROWS: readonly SubmissionRow[] = [
  ["draft", "draft", "absent", "none", true],
  ["submitted", "submitted", "present", "none", false],
  ["rejected", "draft", "absent", "changes_requested", true],
  ["approved", "submitted", "present", "approved", false],
];

type OwnershipRow = readonly [OwnershipDensity, number, boolean];
const OWNERSHIP_ROWS: readonly OwnershipRow[] = [
  ["none", 0, false],
  ["single", 1, false],
  ["multiple", 2, true],
];

// prettier-ignore
type PermissionRow = readonly [PermissionBoundary, boolean, boolean, RequiredRole, boolean];
const PERMISSION_ROWS: readonly PermissionRow[] = [
  ["allowed", true, true, null, false],
  ["owner", true, true, "lead", true],
  ["non-owner", false, true, "lead", true],
  ["head", true, true, "head", false],
  ["admin", true, true, "admin", false],
  ["viewer", true, true, "viewer", false],
  ["anonymous", false, false, null, false],
  ["forbidden", false, true, null, false],
];

function missingOracleValue(key: string): never {
  throw new Error(`Runtime oracle does not define ${key}.`);
}

export function lifecycleExpectation(
  state: LifecycleState,
): LifecycleExpectation {
  const row =
    LIFECYCLE_ROWS.find(([value]) => value === state) ??
    missingOracleValue(state);
  return {
    state,
    period: {
      status: row[1],
      periodState: row[2],
      periodStatus: row[3],
      archived: row[4],
    },
    editable: row[5],
    visibleToStatusObserver: row[6],
  };
}

export function submissionExpectation(
  state: SubmissionState,
): SubmissionExpectation {
  const row =
    SUBMISSION_ROWS.find(([value]) => value === state) ??
    missingOracleValue(state);
  return {
    state,
    sectionStatus: row[1],
    submittedAt: row[2],
    verdict: row[3],
    editable: row[4],
  };
}

export function ownershipExpectation(
  density: OwnershipDensity,
): OwnershipExpectation {
  const row =
    OWNERSHIP_ROWS.find(([value]) => value === density) ??
    missingOracleValue(density);
  return { density, assignedStageCount: row[1], hasForeignOwner: row[2] };
}

export function permissionExpectation(
  boundary: PermissionBoundary,
): PermissionExpectation {
  const row =
    PERMISSION_ROWS.find(([value]) => value === boundary) ??
    missingOracleValue(boundary);
  return {
    boundary,
    allowed: row[1],
    authenticated: row[2],
    requiredRole: row[3],
    requiresOwnership: row[4],
  };
}

export function observePeriodDualState(
  expected: PeriodDualState,
  actual: PeriodDualState,
): PeriodDualStateObservation {
  const fields = ["status", "periodState", "periodStatus", "archived"] as const;
  const mismatches = fields.filter(
    (field) => expected[field] !== actual[field],
  );
  return Object.freeze({
    matches: mismatches.length === 0,
    mismatches: Object.freeze(mismatches),
  });
}

function scalar(
  value: string | number | boolean | null,
): string | number | boolean | null {
  return value;
}

function sectionMismatches(
  expected: SubmissionExpectation,
  actual: RuntimeSectionState,
): readonly RuntimeOracleMismatch[] {
  const fields = [
    ["status", expected.sectionStatus, actual.status],
    ["submittedAt", expected.submittedAt, actual.submittedAt],
    ["verdict", expected.verdict, actual.verdict],
  ] as const;
  return fields
    .filter(([, expectedValue, actualValue]) => expectedValue !== actualValue)
    .map(([field, expectedValue, actualValue]) => ({
      axis: "submission" as const,
      field,
      expected: scalar(expectedValue),
      actual: scalar(actualValue),
    }));
}

function ownershipMismatches(
  expected: OwnershipExpectation,
  actual: RuntimeOwnershipState,
): readonly RuntimeOracleMismatch[] {
  const expectedForeignOwner = actual.owners.some(
    (ownerId) => ownerId !== actual.targetOwnerId,
  );
  const values = [
    ["assignedStageCount", expected.assignedStageCount, actual.owners.length],
    ["hasForeignOwner", expected.hasForeignOwner, expectedForeignOwner],
  ] as const;
  return values
    .filter(([, expectedValue, actualValue]) => expectedValue !== actualValue)
    .map(([field, expectedValue, actualValue]) => ({
      axis: "ownership" as const,
      field,
      expected: scalar(expectedValue),
      actual: scalar(actualValue),
    }));
}

function permissionMismatches(
  expected: PermissionExpectation,
  actual: RuntimePermissionState,
): readonly RuntimeOracleMismatch[] {
  const values = [
    ["authenticated", expected.authenticated, actual.authenticated],
    ["allowed", expected.allowed, actual.allowed],
  ] as const;
  const mismatches: RuntimeOracleMismatch[] = values
    .filter(([, expectedValue, actualValue]) => expectedValue !== actualValue)
    .map(([field, expectedValue, actualValue]) => ({
      axis: "permission" as const,
      field,
      expected: scalar(expectedValue),
      actual: scalar(actualValue),
    }));
  const expectedOwnsTarget = expected.boundary === "owner";
  if (expected.requiresOwnership && expectedOwnsTarget !== actual.ownsTarget) {
    mismatches.push({
      axis: "permission",
      field: "ownsTarget",
      expected: expectedOwnsTarget,
      actual: actual.ownsTarget,
    });
  }
  if (
    expected.requiredRole === null ||
    expected.requiredRole === actual.actorRole
  )
    return mismatches;
  return [
    ...mismatches,
    {
      axis: "permission",
      field: "actorRole",
      expected: expected.requiredRole,
      actual: actual.actorRole,
    },
  ];
}

export function observeRuntimeDatabase(
  expected: RuntimeDomainOracle,
  actual: RuntimeDatabaseSnapshot,
): RuntimeOracleObservation {
  const period = observePeriodDualState(
    expected.lifecycle.period,
    actual.report,
  );
  const lifecycleMismatches = period.mismatches.map((field) => ({
    axis: "lifecycle" as const,
    field,
    expected: scalar(expected.lifecycle.period[field]),
    actual: scalar(actual.report[field]),
  }));
  const mismatches = [
    ...lifecycleMismatches,
    ...sectionMismatches(expected.submission, actual.section),
    ...ownershipMismatches(expected.ownership, actual.ownership),
    ...permissionMismatches(expected.permission, actual.permission),
  ];
  return Object.freeze({
    matches: mismatches.length === 0,
    mismatches: Object.freeze(mismatches),
  });
}

export function buildRuntimeDomainOracle(
  input: Readonly<{
    lifecycle: LifecycleState;
    submission: SubmissionState;
    ownership: OwnershipDensity;
    permission: PermissionBoundary;
  }>,
): RuntimeDomainOracle {
  return Object.freeze({
    lifecycle: lifecycleExpectation(input.lifecycle),
    submission: submissionExpectation(input.submission),
    ownership: ownershipExpectation(input.ownership),
    permission: permissionExpectation(input.permission),
    key: [
      input.lifecycle,
      input.submission,
      input.ownership,
      input.permission,
    ].join("|"),
  });
}
