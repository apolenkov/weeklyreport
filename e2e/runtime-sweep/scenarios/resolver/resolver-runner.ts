import type { FrozenCaseReplayResult } from "../../replay/frozen-case-evidence.ts";
import type { EvidenceRef } from "../../source/contracts.ts";
import { runEmptyResolverCase } from "./resolver-empty-runner.ts";
import { runQueryErrorResolverCase } from "./resolver-query-error-runner.ts";
import { runWithCanonicalReseed } from "./resolver-runner-lifecycle.ts";
import {
  CLEANUP_MESSAGE,
  reseedCanonical,
  resolverArtifact,
  type ResolverCaseRunInput,
} from "./resolver-runner-support.ts";

const withCanonicalReseed = (
  input: ResolverCaseRunInput,
  run: (boundInput: ResolverCaseRunInput) => Promise<FrozenCaseReplayResult>,
): Promise<FrozenCaseReplayResult> => {
  return runWithCanonicalReseed(
    async ({ reseed }) => {
      const cleanupState: { ref: EvidenceRef | undefined } = {
        ref: undefined,
      };
      const cleanupCanonical = async (): Promise<EvidenceRef> => {
        if (cleanupState.ref !== undefined) return cleanupState.ref;
        await reseed();
        cleanupState.ref = await resolverArtifact(
          input,
          "after",
          "resolver-cleanup.json",
          "db",
          "runtime",
          {
            declarationId: input.matrixCase.declarationId,
            route: "/reports/latest",
            operation: "reports.latestForViewer",
            cleanup: CLEANUP_MESSAGE,
          },
        );
        return cleanupState.ref;
      };
      return run({ ...input, cleanupCanonical });
    },
    () => reseedCanonical(input),
    (result) => Promise.resolve(result),
  );
};

export async function runResolverCase(
  input: ResolverCaseRunInput,
): Promise<FrozenCaseReplayResult> {
  switch (input.matrixCase.declarationId) {
    case "viewer-status-empty":
      return withCanonicalReseed(input, runEmptyResolverCase);
    case "viewer-status-query-error":
      return withCanonicalReseed(input, runQueryErrorResolverCase);
    default:
      throw new Error(
        `Unsupported resolver declaration ${input.matrixCase.declarationId ?? "none"}`,
      );
  }
}

export type { ResolverCaseRunInput } from "./resolver-runner-support.ts";
