import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type BugsinkProjectCounters,
  readBugsinkProjectCounters,
} from "../../preflight/observability/environment-observer-bugsink.ts";
import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";
import type { RuntimeObservabilityConfig } from "./runtime-observability-readiness.ts";

const BUGSINK_POLL_MS = 250;
const BUGSINK_STABLE_READS = 4;
const BUGSINK_DEADLINE_MS = 10_000;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const readRuntimeBugsinkBaseline = (
  observability: RuntimeObservabilityConfig,
  fetcher: typeof fetch = fetch,
): Promise<BugsinkProjectCounters> =>
  readBugsinkProjectCounters(observability.bugsink, fetcher);

const sameCounters = (
  left: BugsinkProjectCounters,
  right: BugsinkProjectCounters,
): boolean =>
  left.digested_event_count === right.digested_event_count &&
  left.stored_event_count === right.stored_event_count;

const stableCounters = async (
  input: Readonly<{
    observability: RuntimeObservabilityConfig;
    fetcher: typeof fetch;
    wait: (milliseconds: number) => Promise<void>;
    previous: BugsinkProjectCounters;
    stableReads: number;
    deadline: number;
  }>,
): Promise<BugsinkProjectCounters> => {
  if (input.stableReads >= BUGSINK_STABLE_READS) return input.previous;
  if (Date.now() >= input.deadline)
    throw new Error("Bugsink counters did not stabilize before the deadline");
  await input.wait(BUGSINK_POLL_MS);
  const current = await readBugsinkProjectCounters(
    input.observability.bugsink,
    input.fetcher,
  );
  return stableCounters({
    ...input,
    previous: current,
    stableReads: sameCounters(input.previous, current)
      ? input.stableReads + 1
      : 0,
  });
};

const issuesFor = (
  delta: Readonly<{ digested: number; stored: number }>,
): readonly string[] => [
  ...(delta.digested === 0
    ? []
    : [`Bugsink digested event count changed by ${String(delta.digested)}`]),
  ...(delta.stored === 0
    ? []
    : [`Bugsink stored event count changed by ${String(delta.stored)}`]),
];

const counterRecord = (
  counters: BugsinkProjectCounters,
): Readonly<{ digested: number; stored: number }> => ({
  digested: counters.digested_event_count,
  stored: counters.stored_event_count,
});

export async function writeRuntimeBugsinkRunEvidence(
  input: Readonly<{
    readonly assignment: RuntimeLaneAssignment;
    readonly run: RuntimeLaneRunIdentity;
    readonly observability: RuntimeObservabilityConfig;
    readonly baseline: BugsinkProjectCounters;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly fetcher?: typeof fetch;
    readonly wait?: (milliseconds: number) => Promise<void>;
  }>,
): Promise<void> {
  const fetcher = input.fetcher ?? fetch;
  const initial = await readBugsinkProjectCounters(
    input.observability.bugsink,
    fetcher,
  );
  const final = await stableCounters({
    observability: input.observability,
    fetcher,
    wait: input.wait ?? sleep,
    previous: initial,
    stableReads: 0,
    deadline: Date.now() + BUGSINK_DEADLINE_MS,
  });
  const delta = {
    digested: final.digested_event_count - input.baseline.digested_event_count,
    stored: final.stored_event_count - input.baseline.stored_event_count,
  } as const;
  const issues = issuesFor(delta);
  const report = {
    artifact: "RUNTIME_BUGSINK_RUN_EVIDENCE",
    version: 1,
    sourceSha: input.assignment.sourceSha,
    matrixDigest: input.assignment.matrixDigest,
    assignmentDigest: input.assignment.assignmentDigest,
    runId: input.run.runId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    observedAt: new Date().toISOString(),
    project: "runtime-sweep",
    baseline: counterRecord(input.baseline),
    final: counterRecord(final),
    delta,
    issues,
    status: issues.length === 0 ? "pass" : "fail",
  } as const;
  await writeFile(
    path.join(
      input.assignment.sourceArchiveRoot,
      `OBSERVABILITY-BUGSINK-${input.assignment.assignmentDigest}.json`,
    ),
    `${JSON.stringify(report, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  if (issues.length > 0)
    throw new Error(`Runtime Bugsink evidence failed: ${issues.join("; ")}`);
}
