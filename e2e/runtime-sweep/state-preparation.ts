import type { ReportStatus } from "@customreport/shared";

import { assertNonProdDestructiveTarget } from "../../prisma/_destructive-guard.js";
import * as seed from "../../prisma/seed-constants.js";
import {
  SEED_PROFILE_MANIFESTS,
  type SeedCapability,
} from "../../prisma/seed-profile-contract.js";
import {
  type E2eDatabaseSetup,
  type E2eSetupCommand,
  e2eSetupCommands,
  setupE2eDatabase,
} from "../helpers/e2e-database-setup.js";
import type {
  LifecycleState,
  OwnershipDensity,
  PermissionBoundary,
  Role,
  RouteBindingTarget,
  SeedProfile,
  SubmissionState,
} from "./contracts.ts";
import { sha256Hex } from "./ids.ts";
import {
  type RuntimeSurfaceExpectation,
  runtimeSurfaceExpectation,
} from "./runtime-surface-expectation.ts";
import {
  buildRuntimeDomainOracle,
  observeRuntimeDatabase,
  type RuntimeDatabaseSnapshot,
  type RuntimeDomainOracle,
  type RuntimeOracleObservation,
  type RuntimeSectionState,
} from "./state-oracle.ts";
import type { StateTarget } from "./state-preparation-targets.ts";
import { targetFor } from "./state-preparation-targets.ts";

export type { StateTarget } from "./state-preparation-targets.ts";

const STABLE_SUBMITTED_AT = "2020-01-03T12:00:00.000Z";
const STABLE_REVOKED_AT = "2020-01-03T12:01:00.000Z";

// prettier-ignore
export type RuntimeStateAxes = Readonly<{ lifecycle: LifecycleState; submission: SubmissionState; ownership: OwnershipDensity; permission: PermissionBoundary }>;
export const STATE_REJECTION_REASONS = [
  "profile-missing-capability",
  "stable-row-capacity",
  "owner-without-assignment",
] as const;
export type StateRejectionReason = (typeof STATE_REJECTION_REASONS)[number];

// prettier-ignore
export class ImpossibleRuntimeStateError extends Error { override readonly name = "ImpossibleRuntimeStateError"; constructor(readonly reason: StateRejectionReason, readonly axes: RuntimeStateAxes, message: string) { super(message); } }
// prettier-ignore
export class RuntimeStateTargetError extends Error { override readonly name = "RuntimeStateTargetError"; constructor(readonly reason: "missing-database-url" | "same-as-development" | "destructive-guard", message: string) { super(message); } }

// prettier-ignore
export type ReportStateMutation = Readonly<{ reportId: string; status: ReportStatus; periodState: "scheduled" | "open" | "published" | "archived"; periodStatus: "open" | "published" | "reopened"; archived: boolean; publishedAt: string | null; publishedById: string | null }>;
// prettier-ignore
export type SectionStateMutation = Readonly<{ sectionId: string; state: RuntimeSectionState; submittedAt: string | null; revokedAt: string | null; revokedById: string | null; reviewerId: string }>;
// prettier-ignore
export type StageAssignmentMutation = Readonly<{ stageId: string; userId: string }>;
// prettier-ignore
export type OwnershipStateMutation = Readonly<{ projectId: string; assignments: readonly StageAssignmentMutation[] }>;
// prettier-ignore
export type PermissionSubject = Readonly<{ boundary: PermissionBoundary; actorId: string | null; groupId: string }>;
// prettier-ignore
export type StatePreparationPlan = Readonly<{ profile: SeedProfile; routeRole: Role; routeTarget: RouteBindingTarget; routeKey: string | undefined; axes: RuntimeStateAxes; resetCommands: readonly E2eSetupCommand[]; targets: StateTarget; report: ReportStateMutation; section: SectionStateMutation; ownership: OwnershipStateMutation; permission: PermissionSubject; oracle: RuntimeDomainOracle; surface: RuntimeSurfaceExpectation; digest: string }>;
// prettier-ignore
export type StatePreparationPlanInput = Readonly<{ profile: SeedProfile; routeRole: Role; routeTarget: RouteBindingTarget; routeKey?: string | undefined; axes: RuntimeStateAxes; repoRoot: string }>;

// prettier-ignore
export interface RuntimeStateTransaction { updateReport(mutation: ReportStateMutation): Promise<void>; updateSection(mutation: SectionStateMutation): Promise<void>; replaceOwnership(mutation: OwnershipStateMutation): Promise<void>; readSnapshot(targets: StateTarget, permission: PermissionSubject): Promise<RuntimeDatabaseSnapshot> }
// prettier-ignore
export interface RuntimeStateDatabase { transaction<T>(work: (transaction: RuntimeStateTransaction) => Promise<T>): Promise<T> }
export type RuntimeStateResetter = (
  input: E2eDatabaseSetup,
) => void | Promise<void>;
// prettier-ignore
export type StatePreparationRequest = StatePreparationPlanInput & Readonly<{ databaseUrl: string }>;
// prettier-ignore
export type PreparedRuntimeState = Readonly<{ plan: StatePreparationPlan; actual: RuntimeDatabaseSnapshot; observation: RuntimeOracleObservation }>;

function capabilityFor(axes: RuntimeStateAxes): SeedCapability | undefined {
  switch (axes.lifecycle) {
    case "reopened":
      return "reopen-flow";
    case "published":
      return "published-period";
    case "archived":
      return "archive-flow";
    case "open":
      return axes.submission === "draft" ? undefined : "submission-contrast";
    default:
      throw new Error("Unknown lifecycle state");
  }
}

// prettier-ignore
const ALLOWED_ACTORS: Readonly<Record<Role, string>> = { lead: seed.LEAD_1_ID, head: seed.HEAD_USER_ID, admin: seed.ADMIN_USER_ID, viewer: seed.VIEWER_USER_ID };
// prettier-ignore
const FIXED_ACTORS: Readonly<Record<Exclude<PermissionBoundary, "allowed">, string | null>> = { anonymous: null, "non-owner": seed.LEAD_MARIA_ID, owner: seed.LEAD_1_ID, head: seed.HEAD_USER_ID, admin: seed.ADMIN_USER_ID, viewer: seed.VIEWER_USER_ID, forbidden: seed.LEAD_MARIA_ID };

function actorFor(
  boundary: PermissionBoundary,
  routeRole: Role,
): string | null {
  return boundary === "allowed"
    ? ALLOWED_ACTORS[routeRole]
    : FIXED_ACTORS[boundary];
}

function rejectIfImpossible(
  input: StatePreparationPlanInput,
  target: StateTarget,
): void {
  const capabilities = new Set<string>([
    ...SEED_PROFILE_MANIFESTS[input.profile].capabilities,
  ]);
  const required = [
    capabilityFor(input.axes),
    input.routeTarget === "published" ? "published-period" : undefined,
    input.axes.ownership === "multiple" ? "ownership" : undefined,
  ];
  const missing = required.find(
    (capability): capability is SeedCapability =>
      capability !== undefined && !capabilities.has(capability),
  );
  if (missing !== undefined) {
    throw new ImpossibleRuntimeStateError(
      "profile-missing-capability",
      input.axes,
      `${input.profile} cannot provide ${missing}`,
    );
  }
  if (input.axes.ownership === "multiple" && target.stageIds.length < 2) {
    throw new ImpossibleRuntimeStateError(
      "stable-row-capacity",
      input.axes,
      `${input.profile} has fewer than two stable stage rows`,
    );
  }
  if (input.axes.permission === "owner" && input.axes.ownership === "none") {
    throw new ImpossibleRuntimeStateError(
      "owner-without-assignment",
      input.axes,
      "owner permission requires at least one assigned stage",
    );
  }
}

function assignmentsFor(
  axes: RuntimeStateAxes,
  target: StateTarget,
): readonly StageAssignmentMutation[] {
  const count =
    axes.ownership === "none" ? 0 : axes.ownership === "single" ? 1 : 2;
  return target.stageIds.slice(0, count).map((stageId, index) => ({
    stageId,
    userId:
      index === 0
        ? target.ownerId
        : (target.foreignOwnerIds[0] ?? target.ownerId),
  }));
}

export function buildStatePreparationPlan(
  input: StatePreparationPlanInput,
): StatePreparationPlan {
  if (input.repoRoot.trim() === "") throw new Error("repoRoot is required");
  const target = targetFor(input.profile, input.routeTarget);
  rejectIfImpossible(input, target);
  const oracle = buildRuntimeDomainOracle(input.axes);
  const actorId = actorFor(input.axes.permission, input.routeRole);
  const report = oracle.lifecycle.period;
  const section = oracle.submission;
  const plan: Omit<StatePreparationPlan, "digest"> = {
    profile: input.profile,
    routeRole: input.routeRole,
    routeTarget: input.routeTarget,
    routeKey: input.routeKey,
    axes: input.axes,
    resetCommands: Object.freeze(
      e2eSetupCommands(input.repoRoot, input.profile),
    ),
    targets: target,
    report: {
      reportId: target.reportId,
      ...report,
      publishedAt: report.status === "published" ? STABLE_SUBMITTED_AT : null,
      publishedById: report.status === "published" ? seed.HEAD_USER_ID : null,
    },
    section: {
      sectionId: target.sectionId,
      state: {
        status: section.sectionStatus,
        submittedAt: section.submittedAt,
        verdict: section.verdict,
      },
      submittedAt:
        section.submittedAt === "present" ? STABLE_SUBMITTED_AT : null,
      revokedAt:
        section.verdict === "changes_requested" ? STABLE_REVOKED_AT : null,
      revokedById:
        section.verdict === "changes_requested" ? seed.HEAD_USER_ID : null,
      reviewerId: seed.HEAD_USER_ID,
    },
    ownership: {
      projectId: target.projectId,
      assignments: assignmentsFor(input.axes, target),
    },
    permission: {
      boundary: input.axes.permission,
      actorId,
      groupId: target.groupId,
    },
    oracle,
    surface: runtimeSurfaceExpectation({
      route: input.routeKey ?? `${input.routeRole}:${input.routeTarget}`,
      permission: input.axes.permission,
    }),
  };
  return Object.freeze({ ...plan, digest: sha256Hex(plan) });
}

function assertDatabaseTarget(databaseUrl: string): void {
  if (databaseUrl.trim() === "") {
    throw new RuntimeStateTargetError(
      "missing-database-url",
      "databaseUrl is required",
    );
  }
  if (databaseUrl === process.env.DATABASE_URL) {
    throw new RuntimeStateTargetError(
      "same-as-development",
      "E2E database must differ from DATABASE_URL",
    );
  }
  try {
    const environment =
      process.env.NODE_ENV === undefined
        ? { DATABASE_URL: databaseUrl }
        : { DATABASE_URL: databaseUrl, NODE_ENV: process.env.NODE_ENV };
    assertNonProdDestructiveTarget("runtime-state-preparation", environment);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new RuntimeStateTargetError("destructive-guard", error.message);
    }
    throw error;
  }
}

export async function prepareRuntimeState(
  request: StatePreparationRequest,
  database: RuntimeStateDatabase,
  resetAndSeed: RuntimeStateResetter = setupE2eDatabase,
): Promise<PreparedRuntimeState> {
  assertDatabaseTarget(request.databaseUrl);
  const plan = buildStatePreparationPlan(request);
  await resetAndSeed({
    databaseUrl: request.databaseUrl,
    profile: request.profile,
    repoRoot: request.repoRoot,
  });
  return database.transaction(async (transaction) => {
    await transaction.updateReport(plan.report);
    await transaction.updateSection(plan.section);
    await transaction.replaceOwnership(plan.ownership);
    const actual = await transaction.readSnapshot(
      plan.targets,
      plan.permission,
    );
    return {
      plan,
      actual,
      observation: observeRuntimeDatabase(plan.oracle, actual),
    };
  });
}
