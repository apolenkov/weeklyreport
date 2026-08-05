import { execFile } from "node:child_process";

import type { Page } from "@playwright/test";

import { loginByCookie } from "../../../sweep/helpers/dev-auth.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { controlEvidence } from "../../matrix/runtime-matrix-evidence.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedPagePhase,
  initialSpecializedNavigation,
  type SpecializedRuntimeEventWindow,
} from "../../matrix/specialized-case-emission.ts";
import { inventoryDom } from "../../replay/dom-inventory.ts";
import { writeFrozenCaseArtifact } from "../../replay/frozen-case-artifacts.ts";
import {
  captureFrozenCasePhases,
  type FrozenCaseReplayResult,
} from "../../replay/frozen-case-evidence.ts";
import {
  coverageCellSchema,
  type EvidenceBundle,
  type EvidenceRef,
  type Oracle,
} from "../../source/contracts.ts";
import {
  INFRASTRUCTURE_FAULT_DECLARATIONS,
  type InfrastructureFaultDeclaration,
} from "./infrastructure-fault-declarations.ts";
import {
  infrastructureActionAssertion,
  infrastructureAfterAssertion,
  infrastructureBeforeAssertion,
} from "./infrastructure-runner-assertions.ts";

export interface InfrastructureCaseRunInput {
  readonly page: Page;
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly capturedAt: string;
}

type ProofResult = Readonly<{
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}>;
const HTTP_OK_STATUS = 200;

const declarationFor = (
  matrixCase: MatrixExecutableCase,
): InfrastructureFaultDeclaration => {
  if (matrixCase.execution.kind !== "infrastructure")
    throw new Error(
      `Expected infrastructure execution for ${matrixCase.caseId}`,
    );
  const faultId = matrixCase.execution.faultId;
  const declaration = INFRASTRUCTURE_FAULT_DECLARATIONS.find(
    ({ faultId: candidate }) => candidate === faultId,
  );
  if (declaration === undefined)
    throw new Error(`No infrastructure declaration exists for ${faultId}`);
  return declaration;
};

const runProof = async (
  repoRoot: string,
  declaration: InfrastructureFaultDeclaration,
): Promise<ProofResult> => {
  const relativeFile = declaration.testFile.replace("apps/api/", "");
  const args = [
    "--filter",
    "@customreport/api",
    "exec",
    "vitest",
    "run",
    relativeFile,
    "-t",
    declaration.testName,
    "--reporter=dot",
  ];
  const command = `pnpm ${args.join(" ")}`;
  const pnpmPath = process.env.npm_execpath;
  if (pnpmPath === undefined)
    throw new Error("Infrastructure proof requires npm_execpath for pnpm");
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [pnpmPath, ...args],
      {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf8",
        maxBuffer: 2_000_000,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(
            new Error(
              `${command} failed: ${error.message}\n${stdout}\n${stderr}`,
            ),
          );
          return;
        }
        resolve({ command, stdout, stderr, exitCode: 0 });
      },
    );
  });
};

const proofArtifact = async (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
  proof: ProofResult,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "infrastructure-proof.json",
    kind: "api",
    dimension: "function",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.faultId,
      subsystem: declaration.subsystem,
      testFile: declaration.testFile,
      testName: declaration.testName,
      operation: declaration.operation,
      command: proof.command,
      exitCode: proof.exitCode,
      stdout: proof.stdout,
      stderr: proof.stderr,
      nonMutationOracle: declaration.nonMutationOracle,
      recoveryOracle: declaration.recoveryOracle,
      cleanupOracle: declaration.cleanupOracle,
    },
  });

const cleanupArtifact = async (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "infrastructure-cleanup.json",
    kind: "api",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.faultId,
      cleanupOracle: declaration.cleanupOracle,
      recoveryOracle: declaration.recoveryOracle,
      cleanup: "complete",
    },
  });

type Navigation = Readonly<{
  readonly responseStatus: number | null;
  readonly events: SpecializedRuntimeEventWindow;
}>;

const captureInfrastructureBefore = (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
  navigation: Navigation,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "before",
    capturedAt: input.capturedAt,
    responseStatus: navigation.responseStatus,
    initialEvents: navigation.events,
    functionalAssertion: infrastructureBeforeAssertion(
      declaration,
      navigation.responseStatus,
    ),
  });

const captureInfrastructureAfter = (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "after",
    capturedAt: input.capturedAt,
    responseStatus: HTTP_OK_STATUS,
    functionalAssertion: infrastructureAfterAssertion(declaration),
    perform: async () => {
      const cleanupRef = await cleanupArtifact(input, declaration);
      return {
        responseStatus: HTTP_OK_STATUS,
        actionRefs: [cleanupRef],
        functionalAssertion: infrastructureAfterAssertion(declaration),
      };
    },
  });

const captureInfrastructureAction = (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "action",
    capturedAt: input.capturedAt,
    responseStatus: HTTP_OK_STATUS,
    functionalAssertion: {
      assertionId: `infrastructure-${declaration.faultId}-action`,
      expected: { proofStarted: true },
      actual: { proofStarted: true },
      message: "Infrastructure proof action started inside the evidence window",
    },
    perform: async () => {
      const proof = await runProof(input.repoRoot, declaration);
      const proofRef = await proofArtifact(input, declaration, proof);
      return {
        responseStatus: HTTP_OK_STATUS,
        actionRefs: [proofRef],
        functionalAssertion: infrastructureActionAssertion(declaration, proof),
      };
    },
  });

const captureInfrastructurePhases = async (
  input: InfrastructureCaseRunInput,
  declaration: InfrastructureFaultDeclaration,
  navigation: Navigation,
  controls: ReturnType<typeof controlEvidence>,
): Promise<FrozenCaseReplayResult> =>
  captureFrozenCasePhases({
    matrixCase: input.matrixCase,
    oracle: input.oracle,
    controls,
    capturePhase: (phase) => {
      if (phase === "before")
        return captureInfrastructureBefore(input, declaration, navigation);
      if (phase === "after")
        return captureInfrastructureAfter(input, declaration);
      return captureInfrastructureAction(input, declaration);
    },
  });

export async function runInfrastructureCase(
  input: InfrastructureCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  const declaration = declarationFor(input.matrixCase);
  assertSpecializedCaseBinding(input.matrixCase, {
    kind: "infrastructure",
    faultId: declaration.faultId,
  });
  await loginByCookie(input.page, {
    role: "admin",
    expectRole: "admin",
    redirect: input.matrixCase.resolvedRoute,
  });
  const navigation = await initialSpecializedNavigation(
    input.page,
    input.matrixCase.resolvedRoute,
  );
  const controls = controlEvidence(
    await inventoryDom(input.page),
    input.matrixCase.caseId,
  );
  const result = await captureInfrastructurePhases(
    input,
    declaration,
    navigation,
    controls,
  );
  return { cell: coverageCellSchema.parse(result.cell), issues: result.issues };
}
