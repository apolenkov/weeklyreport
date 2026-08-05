import type { TestInfo } from "@playwright/test";

import { prisma } from "../../../integration/helpers/db.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedPagePhase,
  type SpecializedPagePhaseAction,
  type SpecializedRuntimeEventWindow,
} from "../../matrix/specialized-case-emission.ts";
import { writeFrozenCaseArtifact } from "../../replay/frozen-case-artifacts.ts";
import {
  captureFrozenCasePhases,
  type FrozenCaseReplayResult,
} from "../../replay/frozen-case-evidence.ts";
import {
  type DOMControl,
  type EvidenceBundle,
  type EvidenceRef,
  type Oracle,
} from "../../source/contracts.ts";
import {
  attachConcurrencyEvidence,
  writeConcurrencyEvidence,
} from "./concurrency-evidence.ts";
import {
  assertConflictFeedback,
  assertConverged,
  assertPersisted,
  captureInputs,
  loadInitialSection,
  openPages,
  releaseWrites,
} from "./concurrency-helpers.ts";

type InitialState = Awaited<ReturnType<typeof loadInitialSection>>;
type Pages = Awaited<ReturnType<typeof openPages>>;
type Responses = Awaited<ReturnType<typeof releaseWrites>>;

type ConcurrencyExecution = Extract<
  MatrixExecutableCase["execution"],
  { readonly kind: "concurrency" }
>;

export interface ConcurrencyPhaseRunInput {
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly oracle: Oracle;
  readonly testInfo: TestInfo;
  readonly capturedAt: string;
  readonly initial: InitialState;
  readonly pages: Pages;
  readonly controls: readonly DOMControl[];
  readonly initialEvents: SpecializedRuntimeEventWindow;
  readonly concurrentEvents: SpecializedRuntimeEventWindow;
}

const executionFor = (
  matrixCase: MatrixExecutableCase,
): ConcurrencyExecution => {
  if (matrixCase.execution.kind !== "concurrency")
    throw new Error(`Expected concurrency execution for ${matrixCase.caseId}`);
  return matrixCase.execution;
};

const currentVersion = async (sectionId: string): Promise<number> => {
  const section = await prisma.reportSection.findUniqueOrThrow({
    where: { id: sectionId },
    select: { version: true },
  });
  return section.version;
};

const captureBefore = async (
  input: ConcurrencyPhaseRunInput,
): Promise<EvidenceBundle> => {
  const version = await currentVersion(input.initial.initial.id);
  return captureSpecializedPagePhase({
    page: input.pages.first,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "before",
    capturedAt: input.capturedAt,
    responseStatus: 200,
    initialEvents: input.initialEvents,
    functionalAssertion: {
      assertionId: "concurrency-before-state",
      expected: { version: input.initial.initial.version },
      actual: { version },
      message: "Concurrent contexts started from the same persisted version",
    },
  });
};

const actionArtifact = async (
  input: ConcurrencyPhaseRunInput,
  responses: Responses,
): Promise<EvidenceRef> => {
  const action = executionFor(input.matrixCase).action;
  return writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "concurrency-action.json",
    kind: "control-action",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      controlKey: action.controlKey,
      winnerStatus: responses.firstResponse.status(),
      loserStatus: responses.secondResponse.status(),
      conflictFeedback: true,
      loserReplay: false,
    },
  });
};

const performConcurrencyAction = async (
  input: ConcurrencyPhaseRunInput,
): Promise<SpecializedPagePhaseAction> => {
  const capturedInputs = await captureInputs(
    input.pages.firstGate,
    input.pages.secondGate,
    input.initial,
  );
  const responses = await releaseWrites({
    first: input.pages.first,
    second: input.pages.second,
    firstGate: input.pages.firstGate,
    secondGate: input.pages.secondGate,
  });
  await assertConflictFeedback(input.pages.second, responses.replayObserved);
  const persisted = await assertPersisted(input.initial);
  await attachConcurrencyEvidence(
    input.testInfo,
    input.initial,
    capturedInputs,
    responses,
    persisted,
  );
  const oracleRef = await writeConcurrencyEvidence(
    {
      archiveRoot: input.archiveRoot,
      matrixCase: input.matrixCase,
      capturedAt: input.capturedAt,
    },
    input.initial,
    capturedInputs,
    responses,
    persisted,
  );
  const actionRef = await actionArtifact(input, responses);
  return {
    responseStatus: responses.secondResponse.status(),
    actionRefs: [oracleRef, actionRef],
    functionalAssertion: {
      assertionId: "concurrency-conflict-state",
      expected: {
        conflict: true,
        persistedVersion: input.initial.initial.version + 1,
      },
      actual: {
        conflict: true,
        persistedVersion: persisted.persisted.version,
      },
      message:
        "The stale write produced accessible conflict feedback without a loser mutation",
    },
  };
};

const captureAction = async (
  input: ConcurrencyPhaseRunInput,
): Promise<EvidenceBundle> =>
  captureSpecializedPagePhase({
    page: input.pages.second,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "action",
    capturedAt: input.capturedAt,
    responseStatus: null,
    initialEvents: input.concurrentEvents,
    functionalAssertion: {
      assertionId: "concurrency-conflict-state",
      expected: {
        conflict: true,
        persistedVersion: input.initial.initial.version + 1,
      },
      actual: {
        conflict: true,
        persistedVersion: input.initial.initial.version + 1,
      },
      message:
        "The stale write produced accessible conflict feedback without a loser mutation",
    },
    perform: () => performConcurrencyAction(input),
  });

const captureAfter = async (
  input: ConcurrencyPhaseRunInput,
): Promise<EvidenceBundle> => {
  const persisted = await assertPersisted(input.initial);
  await assertConverged(input.pages.first, input.pages.second);
  const version = await currentVersion(input.initial.initial.id);
  return captureSpecializedPagePhase({
    page: input.pages.first,
    archiveRoot: input.archiveRoot,
    matrixCase: input.matrixCase,
    phase: "after",
    capturedAt: input.capturedAt,
    responseStatus: 200,
    functionalAssertion: {
      assertionId: "concurrency-after-state",
      expected: {
        version: input.initial.initial.version + 1,
        winner: "Runtime sweep stale-version winner item",
        loserPresent: false,
      },
      actual: {
        version,
        winner: persisted.persistedItem?.text ?? null,
        loserPresent: persisted.persisted.items.some(
          (item) => item.text === "Runtime sweep stale-version loser item",
        ),
      },
      message: "Both contexts reloaded the winning state after recovery",
    },
  });
};

export const runConcurrencyPhases = async (
  input: ConcurrencyPhaseRunInput,
): Promise<FrozenCaseReplayResult> => {
  assertSpecializedCaseBinding(input.matrixCase, {
    kind: "concurrency",
    faultId: "period-stale-version",
  });
  return captureFrozenCasePhases({
    matrixCase: input.matrixCase,
    oracle: input.oracle,
    controls: input.controls,
    capturePhase: (phase) => {
      if (phase === "before") return captureBefore(input);
      if (phase === "action") return captureAction(input);
      return captureAfter(input);
    },
  });
};
