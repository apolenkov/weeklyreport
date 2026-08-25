import { FAULT_DECLARATIONS } from "../../scenarios/faults/fault-declarations.ts";
import {
  INFRASTRUCTURE_FAULT_DECLARATIONS,
  type InfrastructureFaultDeclaration,
} from "../../scenarios/infrastructure/infrastructure-fault-declarations.ts";
import {
  type ActionOperation,
  type ActionSafety,
  type ControlTransition,
  type FaultMode,
  type MatrixExecutionKind,
  type ResolverOutcomeKind,
  type Role,
  type SeedProfile,
} from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";

export type SpecializedDeclarationKind =
  "http-fault" | "stale-concurrency" | "infrastructure" | "resolver";

type SpecializedDeclarationBase = Readonly<{
  readonly declarationId: string;
  readonly kind: Exclude<SpecializedDeclarationKind, "resolver">;
  readonly faultId: string;
  readonly faultMode: Exclude<FaultMode, "none">;
  readonly executionKind: Exclude<
    MatrixExecutionKind,
    "navigation" | "idle" | "control" | "recovery"
  >;
  readonly profile: SeedProfile;
  readonly role: Role;
  readonly catalogRoute: string;
  readonly proof: Readonly<{
    readonly testFile: string;
    readonly testName: string;
    readonly target: string;
  }>;
}>;

type SpecializedActionDeclaration = SpecializedDeclarationBase &
  Readonly<{
    readonly executionKind: "fault" | "concurrency";
    readonly operation: ActionOperation;
    readonly safety: ActionSafety;
    readonly transition: ControlTransition;
  }>;

type SpecializedObservationDeclaration = SpecializedDeclarationBase &
  Readonly<{
    readonly executionKind: "infrastructure";
    readonly observationKind: "db" | "api";
  }>;

type ResolverSpecializedDeclaration = Readonly<{
  readonly declarationId: "viewer-status-empty" | "viewer-status-query-error";
  readonly kind: "resolver";
  readonly outcome: Extract<ResolverOutcomeKind, "empty" | "query-error">;
  readonly recoveryOutcome: Extract<
    ResolverOutcomeKind,
    "empty" | "visible-current"
  > | null;
  readonly faultId: string | null;
  readonly faultMode: Extract<FaultMode, "none" | "api-error">;
  readonly executionKind: "navigation" | "fault";
  readonly profile: "demo";
  readonly role: "viewer";
  readonly catalogRoute: "/reports/latest";
  readonly operation: "navigate";
  readonly safety: "read-only";
  readonly transition: "none";
  readonly resolverOperation: "reports.latestForViewer";
  readonly proof: Readonly<{
    readonly testFile: string;
    readonly testName: string;
    readonly target: string;
  }>;
}>;

export type SpecializedDeclaration =
  | SpecializedActionDeclaration
  | SpecializedObservationDeclaration
  | ResolverSpecializedDeclaration;

const REPORT_ROUTE = "/head/report/[reportId]";
const ACTIVE_PROFILE: SeedProfile = "full";
const VIEWER_STATUS_OPERATION = "reports.latestForViewer";

const httpDeclaration = (
  declaration: (typeof FAULT_DECLARATIONS)[number],
): SpecializedDeclaration => ({
  declarationId: declaration.id,
  kind: "http-fault",
  faultId: declaration.id,
  faultMode: declaration.mode,
  executionKind: "fault",
  profile: ACTIVE_PROFILE,
  role: "head",
  catalogRoute: REPORT_ROUTE,
  operation: "publish",
  safety: "irreversible",
  transition: "publish",
  proof: {
    testFile: "e2e/runtime-sweep/scenarios/faults/fault-recovery.spec.ts",
    testName: `${declaration.id} keeps publish non-mutating and recoverable`,
    target: declaration.operation,
  },
});

const concurrencyDeclaration: SpecializedDeclaration = {
  declarationId: "period-stale-version",
  kind: "stale-concurrency",
  faultId: "period-stale-version",
  faultMode: "concurrency-stale-version",
  executionKind: "concurrency",
  profile: ACTIVE_PROFILE,
  role: "lead",
  catalogRoute: "/lead/report/[reportId]",
  operation: "fill",
  safety: "reversible",
  transition: "none",
  proof: {
    testFile: "e2e/runtime-sweep/scenarios/concurrency/concurrency.spec.ts",
    testName: "stale lead edits reject the loser and converge on the winner",
    target: "reports.saveDraft optimistic version check",
  },
};

const infrastructureDeclaration = (
  declaration: InfrastructureFaultDeclaration,
): SpecializedDeclaration => ({
  declarationId: declaration.faultId,
  kind: "infrastructure",
  faultId: declaration.faultId,
  faultMode: "infrastructure-unavailable",
  executionKind: "infrastructure",
  profile: ACTIVE_PROFILE,
  role: "admin",
  catalogRoute: "/admin",
  observationKind: "api",
  proof: {
    testFile: declaration.testFile,
    testName: declaration.testName,
    target: declaration.operation,
  },
});

const resolverDeclarations: readonly ResolverSpecializedDeclaration[] =
  Object.freeze([
    {
      declarationId: "viewer-status-empty",
      kind: "resolver",
      outcome: "empty",
      recoveryOutcome: null,
      faultId: null,
      faultMode: "none",
      executionKind: "navigation",
      profile: "demo",
      role: "viewer",
      catalogRoute: "/reports/latest",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
      resolverOperation: VIEWER_STATUS_OPERATION,
      proof: {
        testFile:
          "e2e/runtime-sweep/scenarios/resolver/resolver-runner.test.ts",
        testName:
          "viewer status empty runs phases then one reseed before cleanup binding",
        target: VIEWER_STATUS_OPERATION,
      },
    },
    {
      declarationId: "viewer-status-query-error",
      kind: "resolver",
      outcome: "query-error",
      recoveryOutcome: "visible-current",
      faultId: "viewer-status-query-error",
      faultMode: "api-error",
      executionKind: "fault",
      profile: "demo",
      role: "viewer",
      catalogRoute: "/reports/latest",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
      resolverOperation: VIEWER_STATUS_OPERATION,
      proof: {
        testFile:
          "e2e/runtime-sweep/scenarios/resolver/resolver-runner.test.ts",
        testName:
          "viewer status query error declares one fault and an explicit successful recovery",
        target: VIEWER_STATUS_OPERATION,
      },
    },
  ]);

export const SPECIALIZED_DECLARATIONS: readonly SpecializedDeclaration[] =
  Object.freeze([
    ...FAULT_DECLARATIONS.map(httpDeclaration),
    concurrencyDeclaration,
    ...INFRASTRUCTURE_FAULT_DECLARATIONS.map(infrastructureDeclaration),
    ...resolverDeclarations,
  ]);

export const SPECIALIZED_DECLARATION_COUNT = SPECIALIZED_DECLARATIONS.length;

export const SPECIALIZED_DECLARATION_IDS: readonly string[] = Object.freeze(
  SPECIALIZED_DECLARATIONS.map(({ declarationId }) => declarationId),
);

export class SpecializedDeclarationError extends Error {
  override readonly name = "SpecializedDeclarationError";
}

export function assertSpecializedDeclarations(
  declarations: readonly object[] = SPECIALIZED_DECLARATIONS,
): void {
  const ids = declarations.flatMap((declaration) => {
    if (
      !("declarationId" in declaration) ||
      typeof declaration.declarationId !== "string"
    )
      return [];
    return [declaration.declarationId];
  });
  if (
    ids.length !== SPECIALIZED_DECLARATION_IDS.length ||
    new Set(ids).size !== ids.length ||
    SPECIALIZED_DECLARATION_IDS.some((id) => !ids.includes(id)) ||
    stableSerialize(declarations) !== stableSerialize(SPECIALIZED_DECLARATIONS)
  ) {
    throw new SpecializedDeclarationError(
      "Specialized declarations must match the canonical seven HTTP, one concurrency, three infrastructure, and two resolver entries",
    );
  }
}
