import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type { RuntimeEventRecords } from "../../matrix/runtime-matrix-evidence.ts";
import {
  type EvidenceBundle,
  evidenceBundleSchema,
} from "../../source/contracts.ts";
import { writeFrozenCaseArtifact } from "../frozen-case-artifacts.ts";
import type { FrozenCaseLiveRuntime } from "../frozen-case-live-actions.ts";

type TailFailures = Readonly<{
  console: boolean;
  pageError: boolean;
  network: boolean;
}>;

const recordCount = (records: RuntimeEventRecords): number =>
  records.consoleMessages.length +
  records.pageErrors.length +
  records.requestFailures.length +
  records.responses.length;

const failuresFor = (records: RuntimeEventRecords): TailFailures => ({
  console: records.consoleMessages.length > 0,
  pageError: records.pageErrors.length > 0,
  network:
    records.requestFailures.length > 0 ||
    records.responses.some(({ ok }) => !ok),
});

const observationAffected = (
  observationId: string,
  records: RuntimeEventRecords,
): boolean =>
  (observationId === "console" && records.consoleMessages.length > 0) ||
  (observationId === "page-error" && records.pageErrors.length > 0) ||
  (observationId === "network" &&
    (records.requestFailures.length > 0 || records.responses.length > 0));

const observationFailed = (
  observationId: string,
  failures: TailFailures,
): boolean =>
  (observationId === "console" && failures.console) ||
  (observationId === "page-error" && failures.pageError) ||
  (observationId === "network" && failures.network);

export const attachLateRuntimeEvents = async (
  input: Readonly<{
    matrixCase: MatrixExecutableCase;
    runtime: FrozenCaseLiveRuntime;
    bundle: EvidenceBundle;
    records: RuntimeEventRecords;
  }>,
): Promise<EvidenceBundle> => {
  const count = recordCount(input.records);
  if (count === 0) return input.bundle;
  const capturedAt = new Date().toISOString();
  const ref = await writeFrozenCaseArtifact({
    archiveRoot: input.runtime.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "late-runtime-events.json",
    kind: "log",
    dimension: "runtime",
    capturedAt,
    value: input.records,
  });
  const failures = failuresFor(input.records);
  const observations = input.bundle.observations.map((observation) => {
    if (!observationAffected(observation.observationId, input.records))
      return observation;
    const failed = observationFailed(observation.observationId, failures);
    return {
      ...observation,
      outcome: failed ? ("fail" as const) : observation.outcome,
      message: failed
        ? `Late ${observation.observationId} event detected after the after-phase snapshot`
        : observation.message,
      evidenceIds: [...observation.evidenceIds, ref.artifactId],
    };
  });
  return evidenceBundleSchema.parse({
    ...input.bundle,
    after: [...input.bundle.after, ref],
    observations,
  });
};
