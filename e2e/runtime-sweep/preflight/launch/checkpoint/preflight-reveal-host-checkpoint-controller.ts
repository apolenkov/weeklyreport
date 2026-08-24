import { readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  type DiagnosticHostEnvelopeSnapshot,
  EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
  readDarwinHostEnvelopeSnapshot,
} from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import type { HealthyPostInfrastructureReceipt } from "../../diagnostics/receipt/preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";
import {
  type HostCheckpointCompletion,
  type HostCheckpointRequest,
  parseCanonicalHostCheckpointCompletion,
  parseCanonicalHostCheckpointRequest,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import {
  assertMailboxRoot,
  assertPrivateFile,
  completionPathFor,
  isCompletionName,
  requestPathFor,
  waitForRequest,
  type WatchDirectory,
} from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";
import {
  type ControllerState,
  processHostCheckpointRequest,
} from "./preflight-reveal-host-checkpoint-controller-processing.ts";
import { assertTerminalCompletion } from "./preflight-reveal-host-checkpoint-controller-terminal.ts";

const CONTROLLER_ABORTED_MESSAGE = "Host checkpoint controller aborted";

export type HostCheckpointControllerIdentity = Readonly<{
  readonly archiveRoot: string;
  readonly mailboxRoot: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly treeDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly stateId: string;
  readonly stateDigest: string;
  readonly profile: string;
  readonly role: string;
  readonly route: string;
  readonly routeDigest: string;
}>;

export type HostCheckpointControllerOptions = HostCheckpointControllerIdentity &
  Readonly<{
    readonly baseline: HealthyPostInfrastructureReceipt;
    readonly signal?: AbortSignal;
    readonly readSnapshot?: (
      phase: "runtime",
    ) => Promise<DiagnosticHostEnvelopeSnapshot>;
    readonly maxCheckpoints?: number;
    readonly watchDirectory?: WatchDirectory;
  }>;

export type HostCheckpointControllerResult = Readonly<{
  readonly responseCount: number;
  readonly lastResponseDigest: string | null;
}>;

const assertControllerCanContinue = (
  input: HostCheckpointControllerOptions,
  responseCount: number,
): boolean => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(CONTROLLER_ABORTED_MESSAGE);
  if (
    input.maxCheckpoints !== undefined &&
    responseCount > input.maxCheckpoints
  )
    throw new Error(
      "Host checkpoint controller exhausted its source-derived checkpoint bound before terminal completion",
    );
  return (
    input.maxCheckpoints !== undefined && responseCount >= input.maxCheckpoints
  );
};

type HostCheckpointMessage =
  | Readonly<{
      readonly kind: "request";
      readonly name: string;
      readonly path: string;
      readonly request: HostCheckpointRequest;
    }>
  | Readonly<{
      readonly kind: "complete";
      readonly name: string;
      readonly path: string;
      readonly completion: HostCheckpointCompletion;
    }>;

const readNextMessage = async (input: {
  readonly mailboxRoot: string;
  readonly seen: ReadonlySet<string>;
  readonly signal?: AbortSignal;
  readonly watchDirectory?: WatchDirectory;
}): Promise<HostCheckpointMessage> => {
  const name = await waitForRequest(input);
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(CONTROLLER_ABORTED_MESSAGE);
  const artifactPath = path.join(input.mailboxRoot, name);
  await assertPrivateFile(artifactPath);
  if (input.seen.has(name))
    throw new Error("Host checkpoint artifact was duplicated");
  if (isCompletionName(name)) {
    const completion = parseCanonicalHostCheckpointCompletion(
      await readFile(artifactPath, "utf8"),
    );
    if (completionPathFor(input.mailboxRoot, completion.run) !== artifactPath)
      throw new Error("Host checkpoint completion filename is not canonical");
    if (input.signal?.aborted)
      throw input.signal.reason ?? new Error(CONTROLLER_ABORTED_MESSAGE);
    return { kind: "complete", name, path: artifactPath, completion };
  }
  const request = parseCanonicalHostCheckpointRequest(
    await readFile(artifactPath, "utf8"),
  );
  if (requestPathFor(input.mailboxRoot, request) !== artifactPath)
    throw new Error("Host checkpoint request filename is not canonical");
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(CONTROLLER_ABORTED_MESSAGE);
  return { kind: "request", name, path: artifactPath, request };
};

const initialControllerStateFor = (
  baseline: HealthyPostInfrastructureReceipt,
): ControllerState => ({
  attemptId: undefined,
  responseCount: 0,
  lastResponseDigest: null,
  expectedSequence: 1,
  previousCheckpointDigest: null,
  previousReceiptHead: null,
  previousReceiptCount: 0,
  previousChunkHead: null,
  previousChunkCount: 0,
  previousCompletedCandidateCount: 0,
  previousSampleSequence: null,
  previousCounters: baseline.lastCounters,
  breachStreaks: EMPTY_HOST_ENVELOPE_BREACH_STREAKS,
});

const assertRequestBelowBound = (atBound: boolean): void => {
  if (atBound)
    throw new Error(
      "Host checkpoint controller exhausted its source-derived checkpoint bound before terminal completion",
    );
};

const runControllerLoop = async (input: {
  readonly controller: HostCheckpointControllerOptions;
  readonly state: ControllerState;
  readonly readSnapshot: (
    phase: "runtime",
  ) => Promise<DiagnosticHostEnvelopeSnapshot>;
}): Promise<HostCheckpointControllerResult> => {
  const { controller, state, readSnapshot } = input;
  const seen = new Set<string>();
  for (;;) {
    const atBound = assertControllerCanContinue(
      controller,
      state.responseCount,
    );
    const next = await readNextMessage({
      mailboxRoot: controller.mailboxRoot,
      seen,
      ...(controller.signal === undefined ? {} : { signal: controller.signal }),
      ...(controller.watchDirectory === undefined
        ? {}
        : { watchDirectory: controller.watchDirectory }),
    });
    if (next.kind === "complete") {
      await assertTerminalCompletion({
        controller,
        state,
        completion: next.completion,
        responseCount: state.responseCount,
        lastResponseDigest: state.lastResponseDigest,
      });
      return {
        responseCount: state.responseCount,
        lastResponseDigest: state.lastResponseDigest,
      };
    }
    assertRequestBelowBound(atBound);
    await processHostCheckpointRequest({
      request: next.request,
      requestPath: next.path,
      state,
      controller,
      baseline: controller.baseline,
      readSnapshot,
      ...(controller.signal === undefined ? {} : { signal: controller.signal }),
    });
    seen.add(next.name);
  }
};

export const runHostCheckpointController = async (
  input: HostCheckpointControllerOptions,
): Promise<HostCheckpointControllerResult> => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(CONTROLLER_ABORTED_MESSAGE);
  await assertMailboxRoot(input.archiveRoot, input.mailboxRoot);
  if (!/^[0-9a-f]{64}$/u.test(input.baseline.baselineReceiptDigest))
    throw new Error("Host checkpoint baseline digest is invalid");
  return runControllerLoop({
    controller: input,
    state: initialControllerStateFor(input.baseline),
    readSnapshot: input.readSnapshot ?? readDarwinHostEnvelopeSnapshot,
  });
};
