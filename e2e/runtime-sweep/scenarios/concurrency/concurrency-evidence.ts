import type { TestInfo } from "@playwright/test";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { writeFrozenCaseArtifact } from "../../replay/evidence/frozen-case-artifacts.ts";
import type { EvidenceRef } from "../../source/contracts.ts";
import {
  assertPersisted,
  captureInputs,
  CONFLICT_FEEDBACK,
  loadInitialSection,
  LOSING_TEXT,
  releaseWrites,
} from "./concurrency-helpers.ts";

type InitialState = Awaited<ReturnType<typeof loadInitialSection>>;
type Inputs = Awaited<ReturnType<typeof captureInputs>>;
type Responses = Awaited<ReturnType<typeof releaseWrites>>;
type Persisted = Awaited<ReturnType<typeof assertPersisted>>;

export interface ConcurrencyEvidenceContext {
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly capturedAt: string;
}

const evidenceValue = (
  initial: InitialState,
  inputs: Inputs,
  responses: Responses,
  persisted: Persisted,
) => ({
  sectionId: initial.initial.id,
  item: {
    initialId: initial.initialItem.id,
    persistedId: persisted.persistedItem?.id ?? null,
    stableId: initial.initialItem.stableId,
  },
  initialVersion: initial.initial.version,
  requests: [
    {
      context: "winner",
      ...inputs.first,
      status: responses.firstResponse.status(),
    },
    {
      context: "loser",
      ...inputs.second,
      status: responses.secondResponse.status(),
    },
  ],
  persisted: {
    version: persisted.persisted.version,
    winningText: persisted.persistedItem?.text ?? null,
    losingTextCount: persisted.persisted.items.filter(
      (item) => item.text === LOSING_TEXT,
    ).length,
  },
  conflictFeedback: CONFLICT_FEEDBACK,
  loserReplay: false,
  nonMutation: persisted.persisted.items.every(
    (item) => item.text !== LOSING_TEXT,
  ),
  recovery: "Both contexts converged after the rejected stale write",
  cleanup:
    "Both gated routes are released, unregistered, and closed by the lane finally block",
});

export async function writeConcurrencyEvidence(
  context: ConcurrencyEvidenceContext,
  initial: InitialState,
  inputs: Inputs,
  responses: Responses,
  persisted: Persisted,
): Promise<EvidenceRef> {
  return writeFrozenCaseArtifact({
    archiveRoot: context.archiveRoot,
    sourceSha: context.matrixCase.sourceSha,
    profile: context.matrixCase.profile,
    role: context.matrixCase.role,
    catalogRoute: context.matrixCase.catalogRoute,
    resolvedRoute: context.matrixCase.resolvedRoute,
    cellId: context.matrixCase.caseId,
    phase: "action",
    fileName: "concurrency-oracle.json",
    kind: "db",
    dimension: "function",
    capturedAt: context.capturedAt,
    value: evidenceValue(initial, inputs, responses, persisted),
  });
}

export async function attachConcurrencyEvidence(
  testInfo: TestInfo,
  initial: InitialState,
  inputs: Inputs,
  responses: Responses,
  persisted: Persisted,
): Promise<void> {
  await testInfo.attach("stale-version-concurrency.json", {
    body: JSON.stringify(evidenceValue(initial, inputs, responses, persisted)),
    contentType: "application/json",
  });
}
