import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { routeForState } from "../execution/playwright-preflight-support.ts";
import {
  appendPreflightJournalStarted,
  appendPreflightJournalTerminal,
  createPreflightSegmentArtifact,
  type PreflightJournalPassRecord,
  preflightSegmentForArtifact,
  readPreflightJournal,
  readPreflightSegmentArtifact,
  resolvePreflightResume,
  validatePreflightJournal,
  writePreflightSegmentArtifact,
} from "./preflight-journal.ts";

const ASSIGNMENT_DIGEST = "a".repeat(64);

const withSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

const segmentFor = (
  state: Awaited<
    ReturnType<typeof buildCampaignSource>
  >["plan"]["states"][number],
) => ({
  state,
  controls: [],
  specialized: [],
});

const artifactReader = async (input: {
  readonly record: PreflightJournalPassRecord;
}) => {
  const artifact = await readPreflightSegmentArtifact(
    input.record.artifactPath,
  );
  return {
    record: input.record,
    segment: preflightSegmentForArtifact(artifact),
  };
};

describe("preflight journal", () => {
  it("writes started then one terminal PASS and rejects a second PASS", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no source state");
      const root = await mkdtemp(path.join(tmpdir(), "preflight-journal-"));
      try {
        const journalPath = path.join(root, "PREFLIGHT.journal.jsonl");
        const artifactPath = path.join(
          root,
          "segments",
          `${state.stateId}.json`,
        );
        const segmentArtifact = createPreflightSegmentArtifact({
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state,
          route: routeForState(source, state),
          segment: segmentFor(state),
        });
        await appendPreflightJournalStarted({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state,
        });
        await writePreflightSegmentArtifact({
          filePath: artifactPath,
          artifact: segmentArtifact,
        });
        await appendPreflightJournalTerminal({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state,
          status: "PASS",
          segmentDigest: segmentArtifact.segmentDigest,
          artifactPath,
          artifactDigest: segmentArtifact.artifactDigest,
        });
        await expect(
          appendPreflightJournalTerminal({
            filePath: journalPath,
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            state,
            status: "PASS",
            segmentDigest: segmentArtifact.segmentDigest,
            artifactPath,
            artifactDigest: segmentArtifact.artifactDigest,
          }),
        ).rejects.toThrow(/without a started attempt|duplicate/u);
        const records = await readPreflightJournal(journalPath);
        expect(
          records.map(({ event, status, attempt }) => [event, status, attempt]),
        ).toEqual([
          ["started", "STARTED", 1],
          ["terminal", "PASS", 1],
        ]);
        expect(
          validatePreflightJournal({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
          }).passRecords.has(state.stateId),
        ).toBe(true);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  it("skips only revalidated PASS artifacts and reruns started, failed, and ambiguous states", async () => {
    await withSource(async (source) => {
      const [passState, failedState, ambiguousState] = source.plan.states;
      if (
        passState === undefined ||
        failedState === undefined ||
        ambiguousState === undefined
      )
        throw new Error("fixture has too few source states");
      const root = await mkdtemp(path.join(tmpdir(), "preflight-journal-"));
      try {
        const journalPath = path.join(root, "PREFLIGHT.journal.jsonl");
        const passArtifactPath = path.join(root, "segments", "pass.json");
        const passArtifact = createPreflightSegmentArtifact({
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: passState,
          route: routeForState(source, passState),
          segment: segmentFor(passState),
        });
        await appendPreflightJournalStarted({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: passState,
        });
        await writePreflightSegmentArtifact({
          filePath: passArtifactPath,
          artifact: passArtifact,
        });
        await appendPreflightJournalTerminal({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: passState,
          status: "PASS",
          segmentDigest: passArtifact.segmentDigest,
          artifactPath: passArtifactPath,
          artifactDigest: passArtifact.artifactDigest,
        });
        await appendPreflightJournalStarted({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: failedState,
        });
        await appendPreflightJournalTerminal({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: failedState,
          status: "FAIL",
        });
        await appendPreflightJournalStarted({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: ambiguousState,
        });
        await appendPreflightJournalTerminal({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: ambiguousState,
          status: "AMBIGUOUS",
        });
        const records = await readPreflightJournal(journalPath);
        const resume = await resolvePreflightResume({
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          records,
          readArtifact: artifactReader,
        });
        expect(resume.skipStateIds).toEqual([passState.stateId]);
        expect(resume.rerunStateIds).toEqual(
          source.plan.states.slice(1).map(({ stateId }) => stateId),
        );
        expect(resume.terminalSegments.get(passState.stateId)).toEqual(
          segmentFor(passState),
        );

        const startedOnlyPath = path.join(root, "started-only.jsonl");
        await appendPreflightJournalStarted({
          filePath: startedOnlyPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: passState,
        });
        const startedOnly = await resolvePreflightResume({
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          records: await readPreflightJournal(startedOnlyPath),
          readArtifact: artifactReader,
        });
        expect(startedOnly.skipStateIds).toEqual([]);
        expect(startedOnly.rerunStateIds).toEqual(
          source.plan.states.map(({ stateId }) => stateId),
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
