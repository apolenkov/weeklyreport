import { appendFile, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { buildCampaignSource } from "../../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../../manifest/manifest-fixture.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  attachSpecializedDeclarations,
  routeForState,
} from "../../execution/playwright-preflight-support.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import { ensurePreflightArchiveRoot } from "../../preflight-archive-path.ts";
import {
  preflightShardCompletionPathFor,
  writePreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
import type { PreflightShardJournalContext } from "../journal/preflight-shard-journal-context.ts";
import type { PreflightShardJournalRecord } from "../journal/preflight-shard-journal-contract.ts";
import { preflightShardJournalPathFor } from "../journal/preflight-shard-journal-io.ts";
import {
  createPreflightShardJournalStarted,
  createPreflightShardJournalTerminal,
} from "../journal/preflight-shard-journal-record.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "../journal/preflight-shard-receipt-paths.ts";
import {
  createPreflightShardStateReceipt,
  writePreflightShardStateReceipt,
} from "../journal/preflight-shard-state-receipt.ts";
import { createPreflightShardAssignment } from "../preflight-shard-assignment.ts";
import { writePreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-io.ts";
import { createPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-planner.ts";
import {
  defaultBrowser,
  defaultRuntime,
  resourcesFor,
} from "../resources/preflight-shard-resource-proof-test-support.ts";
import type { PreflightShardCompletionReadRequest } from "./preflight-shard-merge.ts";
import { preflightShardResourceProofPathFor } from "./preflight-shard-merge-assembly.ts";

type CampaignSource = Awaited<ReturnType<typeof buildCampaignSource>>;

export type PersistedMergeFixture = Readonly<{
  readonly source: CampaignSource;
  readonly assignment: ReturnType<typeof createPreflightShardAssignment>;
  readonly donorRoots: readonly {
    readonly donorId: string;
    readonly root: string;
  }[];
  readonly requests: readonly PreflightShardCompletionReadRequest[];
  readonly dispose: () => Promise<void>;
}>;

const persistSegment = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly state: PreflightShardJournalContext["shard"]["states"][number];
  readonly started: PreflightShardJournalRecord;
  readonly preexistingSpecialized?: boolean;
}) => {
  const nominalSegment = {
    state: input.state.state,
    controls: [],
    specialized: [],
  } as const;
  const segment = input.preexistingSpecialized
    ? (attachSpecializedDeclarations(input.context.source, [
        nominalSegment,
      ])[0] ?? nominalSegment)
    : nominalSegment;
  const segmentArtifact = createPreflightSegmentArtifact({
    source: input.context.source,
    assignmentDigest: input.context.assignment.assignmentDigest,
    state: input.state.state,
    route: routeForState(input.context.source, input.state.state),
    segment,
  });
  const segmentArtifactPath = preflightShardSegmentPathFor({
    context: input.context,
    state: input.state,
    attempt: input.started.attempt,
  });
  await writePreflightSegmentArtifact({
    filePath: segmentArtifactPath,
    artifact: segmentArtifact,
    archiveRoot: input.archiveRoot,
  });
  const receipt = createPreflightShardStateReceipt({
    context: input.context,
    state: input.state,
    started: input.started,
    segmentArtifactPath,
    segmentArtifact,
  });
  const receiptPath = preflightShardStateReceiptPathFor({
    context: input.context,
    state: input.state,
    attempt: input.started.attempt,
  });
  await writePreflightShardStateReceipt({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: receiptPath,
    receipt,
  });
  return { receipt, receiptPath };
};

const persistState = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly state: PreflightShardJournalContext["shard"]["states"][number];
  readonly preexistingSpecialized?: boolean;
  readonly previousRecord?: PreflightShardJournalRecord;
}) => {
  const started = createPreflightShardJournalStarted({
    context: input.context,
    state: input.state,
    attempt: 1,
    ...(input.previousRecord === undefined
      ? {}
      : { previousRecord: input.previousRecord }),
  });
  const { receipt, receiptPath } = await persistSegment({
    context: input.context,
    archiveRoot: input.archiveRoot,
    state: input.state,
    started,
    ...(input.preexistingSpecialized === undefined
      ? {}
      : { preexistingSpecialized: input.preexistingSpecialized }),
  });
  const terminal = createPreflightShardJournalTerminal({
    context: input.context,
    started,
    status: "PASS",
    receipt: {
      path: receiptPath,
      receiptDigest: receipt.receiptDigest,
      segmentDigest: receipt.segmentDigest,
    },
  });
  return { started, terminal };
};

const persistShardStates = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly states: readonly PreflightShardJournalContext["shard"]["states"][number][];
  readonly preexistingSpecializedStateId: string | undefined;
}): Promise<void> => {
  const records: PreflightShardJournalRecord[] = [];
  for (const state of input.states) {
    const previousRecord = records.at(-1);
    const persisted = await persistState({
      context: input.context,
      archiveRoot: input.archiveRoot,
      state,
      preexistingSpecialized:
        state.state.stateId === input.preexistingSpecializedStateId,
      ...(previousRecord === undefined ? {} : { previousRecord }),
    });
    records.push(persisted.started, persisted.terminal);
  }
  await appendFile(
    input.journalPath,
    records.map((record) => `${stableSerialize(record)}\n`).join(""),
    "utf8",
  );
};

const persistShardCompletion = async (input: {
  readonly source: CampaignSource;
  readonly assignment: ReturnType<typeof createPreflightShardAssignment>;
  readonly shard: ReturnType<
    typeof createPreflightShardAssignment
  >["shards"][number];
  readonly donorRoot: string;
  readonly shardIndex: number;
  readonly preexistingSpecializedStateId: string | undefined;
}): Promise<PreflightShardCompletionReadRequest> => {
  const resourceProof = createPreflightShardResourceProof({
    source: input.source,
    assignment: input.assignment,
    shard: input.shard,
    donorId: "Pro",
    donorRoot: input.donorRoot,
    shardAttemptId: "attempt-1",
    browser: defaultBrowser,
    runtime: defaultRuntime,
    resources: resourcesFor(input.donorRoot, input.shardIndex),
  });
  const context: PreflightShardJournalContext = {
    source: input.source,
    assignment: input.assignment,
    shard: input.shard,
    resourceProof,
  };
  const archiveRoot = resourceProof.resources.archiveRoot;
  await ensurePreflightArchiveRoot(archiveRoot);
  const resourceProofPath = preflightShardResourceProofPathFor(context);
  await writePreflightShardResourceProof({
    archiveRoot,
    filePath: resourceProofPath,
    proof: resourceProof,
  });
  const journalPath = preflightShardJournalPathFor(context);
  await persistShardStates({
    context,
    archiveRoot,
    journalPath,
    states: input.shard.states,
    preexistingSpecializedStateId: input.preexistingSpecializedStateId,
  });
  const filePath = preflightShardCompletionPathFor(context);
  await writePreflightShardCompletion({
    context,
    archiveRoot,
    filePath,
    journalPath,
  });
  return {
    context,
    archiveRoot,
    filePath,
    journalPath,
    resourceProofPath,
  };
};

export const createPersistedMergeFixture = async (
  options: Readonly<{ readonly preexistingSpecialized?: boolean }> = {},
): Promise<PersistedMergeFixture> => {
  const manifestFixture = await createManifestFixture();
  const donorRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "preflight-shard-merge-")),
  );
  try {
    const source = await buildCampaignSource(
      manifestFixture.input,
      fakeManifestGit(),
    );
    const oneShard = createPreflightShardAssignment(source, 1);
    const groupCount = new Set(oneShard.states.map(({ groupKey }) => groupKey))
      .size;
    if (groupCount < 2)
      throw new Error("merge fixture requires at least two session groups");
    const assignment = createPreflightShardAssignment(source, 2);
    const declaration = source.specializedDeclarations[0];
    const preexistingSpecializedStateId =
      options.preexistingSpecialized === true && declaration !== undefined
        ? source.plan.states.find(
            (state) =>
              state.profile === declaration.profile &&
              state.axes.route ===
                `${declaration.role}:${declaration.catalogRoute}` &&
              state.axes.lifecycle === "open" &&
              state.axes.submission === "draft" &&
              state.axes.ownershipDensity === "single" &&
              state.axes.permission === "allowed",
          )?.stateId
        : undefined;
    if (
      options.preexistingSpecialized === true &&
      preexistingSpecializedStateId === undefined
    )
      throw new Error("merge fixture has no specialized nominal state");
    const requests = await Promise.all(
      assignment.shards.map((shard, shardIndex) =>
        persistShardCompletion({
          source,
          assignment,
          shard,
          donorRoot,
          shardIndex,
          preexistingSpecializedStateId,
        }),
      ),
    );
    return {
      source,
      assignment,
      donorRoots: [{ donorId: "Pro", root: donorRoot }],
      requests,
      dispose: async () => {
        await rm(donorRoot, { recursive: true, force: true });
        await rm(manifestFixture.root, { recursive: true, force: true });
      },
    };
  } catch (error: unknown) {
    await rm(donorRoot, { recursive: true, force: true });
    await rm(manifestFixture.root, { recursive: true, force: true });
    throw error;
  }
};
