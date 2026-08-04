import {
  type ActionOperation,
  type ActionSafety,
  type ControlTransition,
  type FaultMode,
  type MatrixExecutionKind,
  type Role,
  type SeedProfile,
} from "./contracts.ts";
import { FAULT_DECLARATIONS } from "./fault-declarations.ts";
import { stableSerialize } from "./ids.ts";
import {
  INFRASTRUCTURE_FAULT_DECLARATIONS,
  type InfrastructureFaultDeclaration,
} from "./infrastructure-fault-declarations.ts";

export type SpecializedDeclarationKind =
  "http-fault" | "stale-concurrency" | "infrastructure";

type SpecializedDeclarationBase = Readonly<{
  readonly declarationId: string;
  readonly kind: SpecializedDeclarationKind;
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

export type SpecializedDeclaration =
  SpecializedActionDeclaration | SpecializedObservationDeclaration;

const REPORT_ROUTE = "/head/report/[reportId]";
const ACTIVE_PROFILE: SeedProfile = "full";

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
    testFile: "e2e/runtime-sweep/fault-recovery.spec.ts",
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
    testFile: "e2e/runtime-sweep/concurrency.spec.ts",
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

export const SPECIALIZED_DECLARATIONS: readonly SpecializedDeclaration[] =
  Object.freeze([
    ...FAULT_DECLARATIONS.map(httpDeclaration),
    concurrencyDeclaration,
    ...INFRASTRUCTURE_FAULT_DECLARATIONS.map(infrastructureDeclaration),
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
      "Specialized declarations must match the canonical seven HTTP, one concurrency, and three infrastructure entries",
    );
  }
}
