import type {
  DomControlObservation,
  DomInventory,
} from "../../../../replay/dom/dom-inventory.ts";
import { sha256Hex } from "../../../../support/ids.ts";
import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../../reveal-path.ts";
import { createRevealOperationRecorder } from "../../interaction/evidence/preflight-reveal-operation-recorder.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealPureQueueInput,
} from "../../interaction/preflight-reveal-branches.ts";
import type {
  RevealContinuationReceipt,
  RevealReceiptChunk,
} from "../contracts/preflight-reveal-continuation-schemas.ts";
import { operationEvidenceDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import {
  branchAssetFor,
  revealCandidateIdentityFor,
} from "../receipts/preflight-reveal-continuation-receipt-assets.ts";
import { createRevealOperationEvidence } from "./preflight-reveal-operation-evidence.ts";
import { reduceRevealOperationEvidence } from "./preflight-reveal-operation-evidence-reducer.ts";

export const DIGEST_LENGTH = 64;
const DOM_ORDER_WIDTH = 4;
const CONTROL_A = "button:a:1";
const CONTROL_B = "button:b:1";
const CONTROL_C = "button:c:1";
const proof = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};
const url = "/admin";

const controlFor = (
  controlKey: string,
  target: string,
  expanded: boolean,
  order: number,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(DOM_ORDER_WIDTH, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName: controlKey,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: target,
  ariaExpanded: expanded,
  disclosureIndependence: "source-bound-row-local",
});

const inventoryFor = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });

const inventoryForState = (
  expandedA: boolean,
  expandedB: boolean,
  expandedC: boolean,
): DomInventory =>
  inventoryFor([
    controlFor(CONTROL_A, "row-a", expandedA, 0),
    controlFor(CONTROL_B, "row-b", expandedB, 1),
    controlFor(CONTROL_C, "row-c", expandedC, 2),
  ]);

const actionFor = (
  control: DomControlObservation,
  transition: "open" | "cancel" = "open",
) => ({
  controlKey: control.controlKey,
  operation: "click" as const,
  safety: "read-only" as const,
  transition,
});

const stepFor = (
  action: ReturnType<typeof actionFor>,
  before: ReturnType<typeof revealSurfaceFor>,
  after: ReturnType<typeof revealSurfaceFor>,
) => revealStepFor(action, before, after, url, url, proof);

const branchFor = (
  steps: ReturnType<typeof revealStepFor>[],
  inventory: DomInventory,
): RevealBranch => ({
  path: revealPathFor(steps, url),
  inventory,
  surface: revealSurfaceFor(inventory.controls),
  url,
});

const receiptFor = (input: {
  readonly branchRef: string;
  readonly digest: string;
  readonly candidateId: string;
  readonly action: RevealCandidate["action"];
  readonly terminalBranchRef: string;
  readonly sequence: number;
  readonly actionCount: number;
}): RevealContinuationReceipt =>
  ({
    digest: input.digest,
    branchRef: input.branchRef,
    candidateId: input.candidateId,
    action: input.action,
    sequence: input.sequence,
    actionCount: input.actionCount,
    terminal: { terminalBranchRef: input.terminalBranchRef },
  }) as unknown as RevealContinuationReceipt;

const operationBranchesFor = () => {
  const root = inventoryForState(false, false, false);
  const sourceInventory = inventoryForState(true, false, false);
  const pairInventory = inventoryForState(true, true, false);
  const thirdInventory = inventoryForState(true, false, true);
  const rootSurface = revealSurfaceFor(root.controls);
  const sourceSurface = revealSurfaceFor(sourceInventory.controls);
  const pairSurface = revealSurfaceFor(pairInventory.controls);
  const thirdSurface = revealSurfaceFor(thirdInventory.controls);
  const a = root.controls[0];
  const b = sourceInventory.controls[1];
  const c = sourceInventory.controls[2];
  if (a === undefined || b === undefined || c === undefined)
    throw new Error("Operation fixture controls are missing");
  const aAction = actionFor(a);
  const bAction = actionFor(b);
  const cAction = actionFor(c);
  const aStep = stepFor(aAction, rootSurface, sourceSurface);
  const bStep = stepFor(bAction, sourceSurface, pairSurface);
  const cStep = stepFor(cAction, sourceSurface, thirdSurface);
  const source = branchFor([aStep], sourceInventory);
  const producerTerminal = branchFor([aStep, bStep], pairInventory);
  const consumerTerminal = branchFor([aStep, cStep], thirdInventory);
  const sourceAsset = branchAssetFor(source);
  const producerTerminalAsset = branchAssetFor(producerTerminal);
  const consumerTerminalAsset = branchAssetFor(consumerTerminal);
  const producer: RevealCandidate = { control: b, action: bAction };
  const consumer: RevealCandidate = { control: c, action: cAction };
  const queueInput = {
    candidatesFor: () => [producer, consumer],
  } as unknown as RevealPureQueueInput;
  return {
    consumer,
    consumerTerminal,
    consumerTerminalAsset,
    producer,
    producerTerminal,
    producerTerminalAsset,
    queueInput,
    source,
    sourceAsset,
  };
};

const operationReceiptsFor = (input: {
  readonly branches: ReturnType<typeof operationBranchesFor>;
}): readonly RevealContinuationReceipt[] => {
  const {
    branches: {
      consumer,
      consumerTerminalAsset,
      producer,
      producerTerminalAsset,
      source,
      sourceAsset,
    },
  } = input;
  const producerReceipt = receiptFor({
    branchRef: sourceAsset.digest,
    digest: "p".repeat(DIGEST_LENGTH),
    candidateId: revealCandidateIdentityFor({
      branch: source,
      candidate: producer,
    }),
    action: producer.action,
    terminalBranchRef: producerTerminalAsset.digest,
    sequence: 1,
    actionCount: 3,
  });
  const consumerReceipt = receiptFor({
    branchRef: sourceAsset.digest,
    digest: "q".repeat(DIGEST_LENGTH),
    candidateId: revealCandidateIdentityFor({
      branch: source,
      candidate: consumer,
    }),
    action: consumer.action,
    terminalBranchRef: consumerTerminalAsset.digest,
    sequence: 2,
    actionCount: 5,
  });
  return [producerReceipt, consumerReceipt];
};

export const operationFixture = () => {
  const branches = operationBranchesFor();
  const { consumer, producer, queueInput, source } = branches;
  const childExecutionId = "e".repeat(DIGEST_LENGTH);
  const recorder = createRevealOperationRecorder({
    childExecutionId,
    childOrdinal: 0,
  });
  recorder.recordReplayStep(sha256Hex(source.path.steps[0]));
  recorder.recordCandidate({ source, candidate: producer });
  const lease = recorder.createRestorationLease({
    source,
    terminal: branches.producerTerminal,
    restored: source,
    candidate: producer,
    inverseAction: actionFor(producer.control, "cancel"),
    ariaControlsTarget: "row-b",
    nonMutation: proof,
  });
  recorder.recordCandidate({ source, candidate: consumer, lease });
  const snapshot = recorder.snapshot();
  const run = {} as RevealReceiptChunk["run"];
  const receipts = operationReceiptsFor({ branches });
  const operationEvidence = createRevealOperationEvidence({
    run,
    snapshot,
    chunkSequence: 1,
    grantDigest: "g".repeat(DIGEST_LENGTH),
    predecessorChunkHead: null,
    predecessorOperationDigest: null,
    predecessorActionCount: 1,
    receipts,
  });
  const chunk = {
    chunkSequence: 1,
    predecessorChunkHead: null,
    operationEvidence,
    receipts,
  } as unknown as RevealReceiptChunk;
  return {
    chunk,
    childExecutionId,
    consumer,
    operationEvidence,
    producer,
    queueInput,
    run,
  };
};

export const reduceFixture = (
  fixture: ReturnType<typeof operationFixture>,
  queueInput = fixture.queueInput,
  chunk = fixture.chunk,
  overrides: {
    readonly expectedChildExecutionId?: string;
    readonly expectedChildOrdinal?: number;
    readonly predecessorOperationDigest?: string | null;
    readonly predecessorActionCount?: number;
  } = {},
) =>
  reduceRevealOperationEvidence({
    queueInput,
    chunk,
    expectedChildExecutionId:
      overrides.expectedChildExecutionId ?? fixture.childExecutionId,
    expectedChildOrdinal: overrides.expectedChildOrdinal ?? 0,
    expectedRunDigest: sha256Hex(fixture.run),
    expectedGrantDigest: "g".repeat(DIGEST_LENGTH),
    predecessorOperationDigest: overrides.predecessorOperationDigest ?? null,
    predecessorActionCount: overrides.predecessorActionCount ?? 1,
  });

export const rehashedChunkFor = (
  chunk: RevealReceiptChunk,
  operationBody: Omit<
    RevealReceiptChunk["operationEvidence"],
    "operationDigest"
  >,
): RevealReceiptChunk => ({
  ...chunk,
  operationEvidence: {
    ...operationBody,
    operationDigest: operationEvidenceDigestForBody(operationBody),
  },
});
