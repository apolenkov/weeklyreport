import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import { assertPreflightArchivePath } from "../../preflight-archive-path.ts";
import { parseRevealParentPass } from "../../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import {
  type HostCheckpointCompletion,
  type HostCheckpointRun,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import type { HostCheckpointControllerOptions } from "./preflight-reveal-host-checkpoint-controller.ts";
import { assertPrivateFile } from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";
import type { ControllerState } from "./preflight-reveal-host-checkpoint-controller-processing.ts";

const assertRunIdentity = (
  run: HostCheckpointRun,
  input: HostCheckpointControllerOptions,
): void => {
  if (
    run.campaignId !== input.campaignId ||
    run.sourceSha !== input.sourceSha ||
    run.sourceTree !== input.sourceTree ||
    run.treeDigest !== input.treeDigest ||
    run.sourceDigest !== input.sourceDigest ||
    run.planDigest !== input.planDigest ||
    run.stateId !== input.stateId ||
    run.stateDigest !== input.stateDigest ||
    run.profile !== input.profile ||
    run.role !== input.role ||
    run.route !== input.route ||
    run.routeDigest !== input.routeDigest ||
    input.role !== "admin" ||
    input.profile !== "demo" ||
    input.route !== "admin:/admin"
  )
    throw new Error(
      "Host checkpoint terminal source or selector identity drifted",
    );
};

const readTerminalParentPass = async (input: {
  readonly controller: HostCheckpointControllerOptions;
  readonly completion: HostCheckpointCompletion;
}): Promise<ReturnType<typeof parseRevealParentPass>> => {
  const passPath = path.join(
    input.controller.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_PARENT_PASS.${input.completion.run.attemptId}.${String(input.completion.terminalChildOrdinal)}.json`,
  );
  await assertPreflightArchivePath(input.controller.archiveRoot, passPath);
  await assertPrivateFile(passPath);
  const passBytes = await readFile(passPath);
  if (
    createHash("sha256").update(passBytes).digest("hex") !==
    input.completion.parentPassDigest
  )
    throw new Error("Host checkpoint completion parent PASS digest drifted");
  const passText = passBytes.toString("utf8");
  const pass = (() => {
    try {
      return parseRevealParentPass(JSON.parse(passText) as unknown);
    } catch (error: unknown) {
      throw new Error(
        `Host checkpoint completion parent PASS is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();
  if (`${stableSerialize(pass)}\n` !== passText)
    throw new Error("Host checkpoint completion parent PASS is not canonical");
  return pass;
};

const assertParentPassIdentity = (input: {
  readonly pass: ReturnType<typeof parseRevealParentPass>;
  readonly completion: HostCheckpointCompletion;
}): void => {
  const { pass, completion } = input;
  const run = pass.run;
  const hostRun = completion.run;
  const separator = hostRun.route.indexOf(":");
  const expectedCatalogRoute =
    separator === -1 ? hostRun.route : hostRun.route.slice(separator + 1);
  if (
    run.campaignId !== hostRun.campaignId ||
    run.sourceSha !== hostRun.sourceSha ||
    run.sourceTree !== hostRun.sourceTree ||
    run.treeDigest !== hostRun.treeDigest ||
    run.sourceDigest !== hostRun.sourceDigest ||
    run.planDigest !== hostRun.planDigest ||
    run.attemptId !== hostRun.attemptId ||
    run.state.stateId !== hostRun.stateId ||
    run.stateDigest !== hostRun.stateDigest ||
    run.state.profile !== hostRun.profile ||
    run.selector.stateId !== hostRun.stateId ||
    run.selector.role !== hostRun.role ||
    run.selector.route !== expectedCatalogRoute ||
    run.selector.profile !== hostRun.profile ||
    run.route.role !== hostRun.role ||
    run.route.catalogRoute !== expectedCatalogRoute ||
    run.routeDigest !== hostRun.routeDigest
  )
    throw new Error("Host checkpoint completion parent PASS identity drifted");
};

const assertParentPassChain = (input: {
  readonly pass: ReturnType<typeof parseRevealParentPass>;
  readonly completion: HostCheckpointCompletion;
  readonly state: ControllerState;
}): void => {
  const { pass, completion, state } = input;
  if (
    pass.chain.receiptHead !== completion.receiptHead ||
    pass.chain.receiptCount !== completion.receiptCount ||
    pass.chain.chunkHead !== completion.chunkHead ||
    pass.chain.chunkCount !== completion.chunkCount
  )
    throw new Error("Host checkpoint completion parent PASS chain drifted");
  if (
    state.attemptId !== undefined &&
    state.attemptId !== completion.run.attemptId
  )
    throw new Error("Host checkpoint completion attempt identity drifted");
};

export const assertTerminalCompletion = async (input: {
  readonly controller: HostCheckpointControllerOptions;
  readonly state: ControllerState;
  readonly completion: HostCheckpointCompletion;
  readonly responseCount: number;
  readonly lastResponseDigest: string | null;
}): Promise<void> => {
  const { completion, state } = input;
  assertRunIdentity(completion.run, input.controller);
  if (completion.terminalChildOrdinal + 1 !== input.responseCount)
    throw new Error(
      "Host checkpoint terminal child ordinal does not close the response count",
    );
  if (completion.lastCheckpointSequence !== input.responseCount)
    throw new Error(
      "Host checkpoint terminal sequence does not close the response count",
    );
  if (completion.lastResponseDigest !== input.lastResponseDigest)
    throw new Error("Host checkpoint terminal response digest drifted");
  if (completion.lastSampleSequence !== state.previousSampleSequence)
    throw new Error("Host checkpoint terminal sample sequence drifted");
  if (
    completion.receiptHead !== state.previousReceiptHead ||
    completion.receiptCount !== state.previousReceiptCount ||
    completion.chunkHead !== state.previousChunkHead ||
    completion.chunkCount !== state.previousChunkCount ||
    completion.completedCandidateCount !== state.previousCompletedCandidateCount
  )
    throw new Error("Host checkpoint terminal progress drifted");
  const pass = await readTerminalParentPass(input);
  assertParentPassIdentity({ pass, completion });
  assertParentPassChain({ pass, ...input });
};
