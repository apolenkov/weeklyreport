import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { BrowserPreflightSegmentResult } from "../../execution/playwright-preflight.ts";
import {
  type PreflightRoute,
  routeForState,
} from "../../execution/playwright-preflight-support.ts";
import { redact } from "../../observability/environment-observer-events.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "../../preflight-archive-path.ts";
import {
  preflightGroupNeedsReset,
  preflightSessionGroupKey,
} from "../../runtime/preflight-session.ts";
import type { PreflightShardCompletion } from "../completion/preflight-shard-completion-contract.ts";
import {
  preflightShardCompletionPathFor,
  writePreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
import {
  assertPreflightShardJournalContext,
  type PreflightShardJournalContext,
} from "../journal/preflight-shard-journal-context.ts";
import {
  preflightShardJournalPathFor,
  terminalizeInterruptedPreflightShardState,
} from "../journal/preflight-shard-journal-io.ts";
import { resolvePreflightShardResume } from "../journal/preflight-shard-resume.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import {
  PreflightShardRunnerError,
  runPreflightShardStateAttempt,
} from "./preflight-shard-runner-support.ts";

/** A state runner may return the real Playwright result or its segment alone. */
type PreflightShardStateRunner = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardJournalContext["assignment"];
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly resetRequired: boolean;
}) => Promise<MatrixPreflightSegment | BrowserPreflightSegmentResult>;

export type PreflightShardRunnerInput = Readonly<{
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly journalPath: string;
  readonly completionPath: string;
  readonly assertLiveSource: () => Promise<void>;
  readonly recreateDisposableBoundary: () => Promise<void>;
  readonly runState: PreflightShardStateRunner;
}>;

export type PreflightShardRunnerResult = Readonly<{
  readonly completion: PreflightShardCompletion;
  readonly skippedStateIds: readonly string[];
  readonly rerunStateIds: readonly string[];
}>;

const assertInputContextAndPaths = (input: PreflightShardRunnerInput): void => {
  assertPreflightShardJournalContext(input.context);
  const expectedArchiveRoot = input.context.resourceProof.resources.archiveRoot;
  if (input.archiveRoot !== expectedArchiveRoot)
    throw new PreflightShardRunnerError(
      "Shard runner archive root does not match the resource proof",
    );
  if (input.journalPath !== preflightShardJournalPathFor(input.context))
    throw new PreflightShardRunnerError(
      "Shard runner journal path does not match the shard attempt",
    );
  if (input.completionPath !== preflightShardCompletionPathFor(input.context))
    throw new PreflightShardRunnerError(
      "Shard runner completion path does not match the shard attempt",
    );
};

const assertBoundary = async (
  input: PreflightShardRunnerInput,
): Promise<void> => {
  assertInputContextAndPaths(input);
  await input.assertLiveSource();
  assertInputContextAndPaths(input);
};

const sourceStateAndRouteFor = (
  context: PreflightShardJournalContext,
  assigned: PreflightShardState,
): Readonly<{
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
}> => {
  const state = context.source.plan.states[assigned.planIndex];
  if (
    state === undefined ||
    stableSerialize(state) !== stableSerialize(assigned.state)
  )
    throw new PreflightShardRunnerError(
      `Shard assignment plan index drifted for ${assigned.state.stateId}`,
    );
  const route = routeForState(context.source, state);
  if (
    route.role !== assigned.role ||
    route.catalogRoute !== assigned.catalogRoute ||
    route.resolvedRoute !== assigned.resolvedRoute
  )
    throw new PreflightShardRunnerError(
      `Shard assignment route identity drifted for ${assigned.state.stateId}`,
    );
  return { state, route };
};

const terminalizeInterrupted = async (
  input: PreflightShardRunnerInput,
): Promise<void> => {
  await assertBoundary(input);
  await terminalizeInterruptedPreflightShardState({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.journalPath,
  });
  await assertBoundary(input);
};

const resolveResume = (input: PreflightShardRunnerInput) =>
  resolvePreflightShardResume({
    context: input.context,
    archiveRoot: input.archiveRoot,
    journalPath: input.journalPath,
  });

const safeRunnerErrorFor = (error: unknown): PreflightShardRunnerError => {
  const message = redact(
    error instanceof Error ? error.message : String(error),
  );
  if (error instanceof PreflightShardRunnerError && message === error.message)
    return error;
  return new PreflightShardRunnerError(
    message || "Unknown preflight shard runner failure",
  );
};

/**
 * Execute exactly one source-bound shard and publish only its durable
 * completion evidence. Resume is authorized by revalidated on-disk receipts;
 * skipped states never establish the prepared live session group.
 */
const runPreflightShardUnsafe = async (
  input: PreflightShardRunnerInput,
): Promise<PreflightShardRunnerResult> => {
  assertInputContextAndPaths(input);
  await input.assertLiveSource();
  await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(input.archiveRoot, input.journalPath);
  await assertPreflightArchivePath(input.archiveRoot, input.completionPath);
  await assertBoundary(input);

  const initialResume = await resolveResume(input);
  const resume =
    initialResume.interruptedStateId === null
      ? initialResume
      : (await terminalizeInterrupted(input), await resolveResume(input));
  if (resume.authorizedSkipStateIds.length > 0) {
    await assertBoundary(input);
    await input.recreateDisposableBoundary();
    await assertBoundary(input);
  }

  const skippedStateIds = [...resume.authorizedSkipStateIds];
  const rerunStateIds = [...resume.rerunStateIds];
  const execution = { preparedGroup: undefined as string | undefined };
  for (const assigned of input.context.shard.states) {
    await assertBoundary(input);
    const stateId = assigned.state.stateId;
    if (skippedStateIds.includes(stateId)) continue;
    const { state, route } = sourceStateAndRouteFor(input.context, assigned);
    const nextGroup = preflightSessionGroupKey(state, route);
    execution.preparedGroup = await runPreflightShardStateAttempt({
      runner: input,
      assigned,
      sourceState: state,
      route,
      resetRequired: preflightGroupNeedsReset(
        execution.preparedGroup,
        nextGroup,
        false,
      ),
      assertBoundary,
    });
  }

  await assertBoundary(input);
  const completion = await writePreflightShardCompletion({
    context: input.context,
    archiveRoot: input.archiveRoot,
    filePath: input.completionPath,
    journalPath: input.journalPath,
  });
  await assertBoundary(input);
  return { completion, skippedStateIds, rerunStateIds };
};

export const runPreflightShard = async (
  input: PreflightShardRunnerInput,
): Promise<PreflightShardRunnerResult> => {
  try {
    return await runPreflightShardUnsafe(input);
  } catch (error: unknown) {
    throw safeRunnerErrorFor(error);
  }
};

/** Alias retained for callers that name the durable journal explicitly. */
