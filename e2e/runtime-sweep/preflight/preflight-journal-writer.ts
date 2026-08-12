import type { SourceArtifact } from "../source/source-artifact.ts";
import type { PreflightRoute } from "./playwright-preflight-support.ts";
import type { PreflightAssignment } from "./preflight-assignment.ts";
import type {
  PreflightJournalRecord,
  PreflightJournalStatus,
} from "./preflight-journal-contract.ts";
import {
  appendPreflightJournalStarted,
  appendPreflightJournalTerminal,
} from "./preflight-journal-io.ts";

type JournalOperation<T> = () => Promise<T>;

export type PreflightJournalWriter = Readonly<{
  readonly appendStarted: (input: {
    readonly state: SourceArtifact["plan"]["states"][number];
    readonly route?: PreflightRoute;
  }) => Promise<PreflightJournalRecord>;
  readonly appendTerminal: (input: {
    readonly state: SourceArtifact["plan"]["states"][number];
    readonly route?: PreflightRoute;
    readonly status: Exclude<PreflightJournalStatus, "STARTED">;
    readonly segmentDigest?: string;
    readonly artifactPath?: string;
    readonly artifactDigest?: string;
  }) => Promise<PreflightJournalRecord>;
}>;

/**
 * Serializes all journal writes through one promise chain. The append-only
 * JSONL primitive validates the complete prior chain before each append; this
 * wrapper prevents two state boundaries from racing that read/append pair.
 */
export const createPreflightJournalWriter = (input: {
  readonly filePath: string;
  readonly source: SourceArtifact;
  readonly assignmentDigest: PreflightAssignment["assignmentDigest"];
  readonly archiveRoot?: string;
}): PreflightJournalWriter => {
  const queue = { pending: Promise.resolve() };
  const enqueue = <T>(operation: JournalOperation<T>): Promise<T> => {
    const result = queue.pending.then(operation, operation);
    queue.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const common = {
    filePath: input.filePath,
    source: input.source,
    assignmentDigest: input.assignmentDigest,
    ...(input.archiveRoot === undefined
      ? {}
      : { archiveRoot: input.archiveRoot }),
  } as const;
  return {
    appendStarted: ({ state, route }) =>
      enqueue(() =>
        appendPreflightJournalStarted({
          ...common,
          state,
          ...(route === undefined ? {} : { route }),
        }),
      ),
    appendTerminal: ({
      state,
      route,
      status,
      segmentDigest,
      artifactPath,
      artifactDigest,
    }) =>
      enqueue(() =>
        appendPreflightJournalTerminal({
          ...common,
          state,
          status,
          ...(route === undefined ? {} : { route }),
          ...(segmentDigest === undefined ? {} : { segmentDigest }),
          ...(artifactPath === undefined ? {} : { artifactPath }),
          ...(artifactDigest === undefined ? {} : { artifactDigest }),
        }),
      ),
  };
};
