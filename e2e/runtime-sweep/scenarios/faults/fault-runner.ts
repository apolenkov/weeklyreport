import type { Page, TestInfo } from "@playwright/test";

import { resetMutations } from "../../../integration/helpers/db.ts";
import { loginByCookie } from "../../../sweep/helpers/dev-auth.ts";
import type { FunctionalAssertion } from "../../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { controlEvidence } from "../../matrix/runtime-matrix-evidence.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedPagePhase,
  initialSpecializedNavigation,
  type SpecializedRuntimeEventWindow,
} from "../../matrix/specialized-case-emission.ts";
import { inventoryDom } from "../../replay/dom-inventory.ts";
import {
  captureFrozenCasePhases,
  type FrozenCaseReplayResult,
} from "../../replay/frozen-case-evidence.ts";
import { type EvidenceBundle, type Oracle } from "../../source/contracts.ts";
import { FAULT_DECLARATIONS } from "./fault-declarations.ts";
import { type FaultDeclaration, withFault } from "./fault-injection.ts";
import {
  actionArtifact,
  cleanupArtifact,
  finalizeFaultCoverage,
  oracleArtifact,
  recoveryArtifact,
} from "./fault-runner-artifacts.ts";
import {
  assertFailureFeedback,
  assertUnchanged,
  observePublish,
  type PublishObservation,
  recover,
  REPORT_PATH,
  type ReportState,
  reportState,
} from "./fault-runner-support.ts";

export interface FaultCaseRunInput {
  readonly page: Page;
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly testInfo: TestInfo;
  readonly capturedAt: string;
}

type FaultExecution = Extract<
  MatrixExecutableCase["execution"],
  { readonly kind: "fault" }
>;

const executionFor = (matrixCase: MatrixExecutableCase): FaultExecution => {
  if (matrixCase.execution.kind !== "fault")
    throw new Error(`Expected fault execution for ${matrixCase.caseId}`);
  return matrixCase.execution;
};

const declarationFor = (matrixCase: MatrixExecutableCase): FaultDeclaration => {
  const faultId = executionFor(matrixCase).faultId;
  const declaration = FAULT_DECLARATIONS.find(({ id }) => id === faultId);
  if (declaration === undefined)
    throw new Error(`No HTTP fault declaration exists for ${faultId}`);
  return declaration;
};

const assertObservation = (
  declaration: FaultDeclaration,
  observation: PublishObservation,
): void => {
  if (declaration.response === null) {
    if (observation.failure === null)
      throw new Error(`Fault ${declaration.id} did not fail its request`);
    return;
  }
  if (observation.response?.status() !== declaration.response.status)
    throw new Error(
      `Fault ${declaration.id} returned ${observation.response?.status() ?? "no response"}; expected ${declaration.response.status}`,
    );
};

const actionAssertion = (
  declaration: FaultDeclaration,
  observation: PublishObservation,
): FunctionalAssertion => ({
  assertionId: `fault-${declaration.id}-action`,
  expected: {
    requestMatched: true,
    responseStatus: declaration.response?.status ?? null,
    requestFailed: declaration.response === null,
    feedbackVisible: true,
    persistedState: "unchanged",
  },
  actual: {
    requestMatched: true,
    responseStatus: observation.response?.status() ?? null,
    requestFailed: observation.failure !== null,
    feedbackVisible: true,
    persistedState: "unchanged",
  },
  message:
    "The declared publish fault was observed without a persisted mutation",
});

const recoveryAssertion = (
  declaration: FaultDeclaration,
  recovered: ReportState,
): FunctionalAssertion => ({
  assertionId: `fault-${declaration.id}-recovery`,
  expected: {
    recovery: declaration.expectation.recovery,
    status: declaration.expectation.recovery === "retry" ? "published" : "open",
  },
  actual: {
    recovery: declaration.expectation.recovery,
    status: recovered.status,
  },
  message:
    "The fault recovery policy produced a terminal persisted-state observation",
});

const captureFaultPhases = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  before: ReportState,
  controls: ReturnType<typeof controlEvidence>,
  navigation: Readonly<{
    readonly responseStatus: number | null;
    readonly events: SpecializedRuntimeEventWindow;
  }>,
): Promise<FrozenCaseReplayResult> =>
  captureFrozenCasePhases({
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    oracle: input.oracle,
    controls,
    capturePhase: (phase) => {
      if (phase === "before")
        return captureSpecializedPagePhase({
          page: input.page,
          archiveRoot: input.archiveRoot,
          matrixCase: input.matrixCase,
          phase,
          capturedAt: input.capturedAt,
          responseStatus: navigation.responseStatus,
          initialEvents: navigation.events,
          functionalAssertion: {
            assertionId: `fault-${declaration.id}-before`,
            expected: { reachable: true, status: "open" },
            actual: { reachable: true, status: before.status },
            message: "Fault scenario started from the seeded report state",
          },
        });
      if (phase === "action")
        return captureFaultAction(input, declaration, before);
      return captureFaultRecovery(input, declaration, before);
    },
  });

const captureFaultAction = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  before: ReportState,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "action",
    capturedAt: input.capturedAt,
    responseStatus: null,
    functionalAssertion: {
      assertionId: `fault-${declaration.id}-action`,
      expected: {
        requestMatched: true,
        responseStatus: declaration.response?.status ?? null,
        requestFailed: declaration.response === null,
        feedbackVisible: true,
        persistedState: "unchanged",
      },
      actual: {
        requestMatched: true,
        responseStatus: declaration.response?.status ?? null,
        requestFailed: declaration.response === null,
        feedbackVisible: true,
        persistedState: "unchanged",
      },
      message:
        "The declared publish fault was observed without a persisted mutation",
    },
    perform: async () => {
      const observation = await withFault(input.page, declaration, () =>
        observePublish(input.page, declaration),
      );
      assertObservation(declaration, observation);
      const failed = await reportState();
      assertUnchanged(before, failed);
      await assertFailureFeedback(input.page, declaration);
      const [oracleRef, actionRef] = await Promise.all([
        oracleArtifact(input, declaration, before, failed, observation),
        actionArtifact(input, declaration, observation),
      ]);
      return {
        responseStatus: observation.response?.status() ?? null,
        actionRefs: [oracleRef, actionRef],
        functionalAssertion: actionAssertion(declaration, observation),
      };
    },
  });

const captureFaultRecovery = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  before: ReportState,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.page,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "after",
    capturedAt: input.capturedAt,
    responseStatus: 200,
    functionalAssertion: recoveryAssertion(declaration, before),
    perform: async () => {
      const recovered = await recover(input.page, declaration);
      if (declaration.expectation.recovery === "retry") {
        if (
          recovered.status !== "published" ||
          recovered.periodState !== "published" ||
          recovered.periodStatus !== "published" ||
          recovered.publishedAt === null ||
          recovered.publishedById === null
        )
          throw new Error(`Fault ${declaration.id} retry did not publish`);
      } else {
        assertUnchanged(before, recovered);
      }
      const recoveryRef = await recoveryArtifact(input, declaration, recovered);
      return {
        responseStatus: 200,
        actionRefs: [recoveryRef],
        functionalAssertion: recoveryAssertion(declaration, recovered),
      };
    },
  });

export async function runFaultCase(
  input: FaultCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  const declaration = declarationFor(input.matrixCase);
  assertSpecializedCaseBinding(input.matrixCase, {
    kind: "fault",
    faultId: declaration.id,
  });
  await resetMutations();
  try {
    await loginByCookie(input.page, {
      role: "head",
      expectRole: "head",
      redirect: REPORT_PATH,
    });
    const navigation = await initialSpecializedNavigation(
      input.page,
      REPORT_PATH,
    );
    const before = await reportState();
    const controls = controlEvidence(
      await inventoryDom(input.page),
      input.matrixCase.caseId,
    );
    const result = await captureFaultPhases(
      input,
      declaration,
      before,
      controls,
      navigation,
    );
    await resetMutations();
    assertUnchanged(before, await reportState());
    return await finalizeFaultCoverage(
      input,
      result,
      await cleanupArtifact(input, declaration),
    );
  } finally {
    await resetMutations();
  }
}
