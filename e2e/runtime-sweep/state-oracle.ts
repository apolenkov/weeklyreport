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
} from "./contracts.ts";

export type RequiredRole = DbRole | null;
export type PeriodDualState = Readonly<{
  status: ReportStatus;
  periodState: PeriodState;
  periodStatus: PeriodStatus;
  archived: boolean;
}>;
export type LifecycleExpectation = Readonly<{
  state: LifecycleState;
  period: PeriodDualState;
  editable: boolean;
  visibleToStatusObserver: boolean;
}>;
export type SubmissionExpectation = Readonly<{
  state: SubmissionState;
  sectionStatus: "draft" | "submitted";
  submittedAt: "absent" | "present";
  verdict: "none" | "approved" | "changes_requested";
  editable: boolean;
}>;
export type OwnershipExpectation = Readonly<{
  density: OwnershipDensity;
  assignedStageCount: number;
  hasForeignOwner: boolean;
}>;
export type PermissionExpectation = Readonly<{
  boundary: PermissionBoundary;
  allowed: boolean;
  authenticated: boolean;
  requiredRole: RequiredRole;
  requiresOwnership: boolean;
}>;
export type PeriodDualStateObservation = Readonly<{
  matches: boolean;
  mismatches: readonly (keyof PeriodDualState)[];
}>;
export type RuntimeDomainOracle = Readonly<{
  lifecycle: LifecycleExpectation;
  submission: SubmissionExpectation;
  ownership: OwnershipExpectation;
  permission: PermissionExpectation;
  key: string;
}>;

type LifecycleRow = readonly [
  LifecycleState,
  ReportStatus,
  PeriodState,
  PeriodStatus,
  boolean,
  boolean,
  boolean,
];
const LIFECYCLE_ROWS: readonly LifecycleRow[] = [
  ["open", "draft", "open", "open", false, true, true],
  ["reopened", "published", "open", "reopened", false, true, true],
  ["published", "published", "published", "published", false, false, true],
  ["archived", "published", "archived", "published", true, false, true],
];

type SubmissionRow = readonly [
  SubmissionState,
  "draft" | "submitted",
  "absent" | "present",
  "none" | "approved" | "changes_requested",
  boolean,
];
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

type PermissionRow = readonly [
  PermissionBoundary,
  boolean,
  boolean,
  RequiredRole,
  boolean,
];
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
