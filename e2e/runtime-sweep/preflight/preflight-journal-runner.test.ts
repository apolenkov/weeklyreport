import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import {
  appendPreflightJournalStarted,
  createPreflightAssignment,
  readPreflightJournal,
  runJournaledPreflight,
  writePreflightAssignment,
} from "./preflight-journal.ts";

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

const setup = async (
  source: Awaited<ReturnType<typeof buildCampaignSource>>,
) => {
  const archiveRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "preflight-runner-")),
  );
  const assignment = createPreflightAssignment(source);
  const assignmentPath = path.join(archiveRoot, "PREFLIGHT_ASSIGNMENT.json");
  await writePreflightAssignment({
    archiveRoot,
    filePath: assignmentPath,
    assignment,
  });
  return {
    archiveRoot,
    assignment,
    assignmentPath,
    journalPath: path.join(archiveRoot, "PREFLIGHT.journal.jsonl"),
    preflightPath: path.join(archiveRoot, "PREFLIGHT.json"),
    segmentRoot: path.join(archiveRoot, "segments"),
  };
};

describe("journaled preflight runner", () => {
  it("restarts a failed whole state and publishes only the complete ordered union", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      try {
        const failures = { remaining: 1 };
        await expect(
          runJournaledPreflight({
            source,
            assignment: paths.assignment,
            assignmentPath: paths.assignmentPath,
            archiveRoot: paths.archiveRoot,
            journalPath: paths.journalPath,
            preflightPath: paths.preflightPath,
            segmentRoot: paths.segmentRoot,
            assertLiveSource: () => Promise.resolve(),
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => {
              if (failures.remaining > 0) {
                failures.remaining -= 1;
                throw new Error("simulated state failure");
              }
              return Promise.resolve(segmentFor(state));
            },
          }),
        ).rejects.toThrow(/ended FAIL/u);
        expect(
          (await readPreflightJournal(paths.journalPath)).map(
            ({ status }) => status,
          ),
        ).toEqual(["STARTED", "FAIL"]);

        const resetFlags: boolean[] = [];
        const result = await runJournaledPreflight({
          source,
          assignment: paths.assignment,
          assignmentPath: paths.assignmentPath,
          archiveRoot: paths.archiveRoot,
          journalPath: paths.journalPath,
          preflightPath: paths.preflightPath,
          segmentRoot: paths.segmentRoot,
          assertLiveSource: () => Promise.resolve(),
          recreateDisposableBoundary: () => Promise.resolve(),
          runState: ({ state, resetRequired }) => {
            resetFlags.push(resetRequired);
            return Promise.resolve(segmentFor(state));
          },
        });
        expect(result.rerunStateIds).toEqual(
          source.plan.states.map(({ stateId }) => stateId),
        );
        expect(resetFlags).toEqual(source.plan.states.map(() => true));
        expect(
          result.artifact.segments.map(({ state }) => state.stateId),
        ).toEqual(source.plan.states.map(({ stateId }) => stateId));
        expect(result.artifact.sourceDigest).toBe(source.sourceDigest);
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("records a post-state boundary failure as FAIL before PASS commit", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      try {
        let boundaryChecks = 0;
        await expect(
          runJournaledPreflight({
            source,
            assignment: paths.assignment,
            assignmentPath: paths.assignmentPath,
            archiveRoot: paths.archiveRoot,
            journalPath: paths.journalPath,
            preflightPath: paths.preflightPath,
            segmentRoot: paths.segmentRoot,
            assertLiveSource: () => {
              boundaryChecks += 1;
              return boundaryChecks === 3
                ? Promise.reject(new Error("post-state source drift"))
                : Promise.resolve();
            },
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        ).rejects.toThrow(/post-state source drift/u);
        expect(
          (await readPreflightJournal(paths.journalPath)).map(
            ({ status }) => status,
          ),
        ).toEqual(["STARTED", "FAIL"]);

        const resumed = await runJournaledPreflight({
          source,
          assignment: paths.assignment,
          assignmentPath: paths.assignmentPath,
          archiveRoot: paths.archiveRoot,
          journalPath: paths.journalPath,
          preflightPath: paths.preflightPath,
          segmentRoot: paths.segmentRoot,
          assertLiveSource: () => Promise.resolve(),
          recreateDisposableBoundary: () => Promise.resolve(),
          runState: ({ state }) => Promise.resolve(segmentFor(state)),
        });
        expect(resumed.skippedStateIds).toEqual([]);
        expect(resumed.rerunStateIds).toEqual(
          source.plan.states.map(({ stateId }) => stateId),
        );
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("rejects live source or assignment drift at the state boundary", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      try {
        await expect(
          runJournaledPreflight({
            source,
            assignment: paths.assignment,
            assignmentPath: paths.assignmentPath,
            archiveRoot: paths.archiveRoot,
            journalPath: paths.journalPath,
            preflightPath: paths.preflightPath,
            segmentRoot: paths.segmentRoot,
            assertLiveSource: () =>
              Promise.reject(new Error("clean source drift")),
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        ).rejects.toThrow(/clean source drift/u);
        const drifted = {
          ...paths.assignment,
          states: paths.assignment.states.toReversed(),
        };
        await expect(
          runJournaledPreflight({
            source,
            assignment: paths.assignment,
            assignmentPath: paths.assignmentPath,
            archiveRoot: paths.archiveRoot,
            journalPath: path.join(paths.archiveRoot, "drift.journal.jsonl"),
            preflightPath: path.join(paths.archiveRoot, "drift.PREFLIGHT.json"),
            segmentRoot: path.join(paths.archiveRoot, "drift-segments"),
            assertLiveSource: () => Promise.resolve(),
            recreateDisposableBoundary: () => Promise.resolve(),
            readAssignment: () => Promise.resolve(drifted),
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        ).rejects.toThrow(/PREFLIGHT_ASSIGNMENT changed/u);
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("does not follow a symlinked segment directory", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      const outside = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-outside-")),
      );
      try {
        await symlink(outside, paths.segmentRoot);
        await expect(
          runJournaledPreflight({
            source,
            assignment: paths.assignment,
            assignmentPath: paths.assignmentPath,
            archiveRoot: paths.archiveRoot,
            journalPath: path.join(paths.archiveRoot, "symlink.journal.jsonl"),
            preflightPath: path.join(
              paths.archiveRoot,
              "symlink.PREFLIGHT.json",
            ),
            segmentRoot: paths.segmentRoot,
            assertLiveSource: () => Promise.resolve(),
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => Promise.resolve(segmentFor(state)),
          }),
        ).rejects.toThrow(/symlink|regular directory/u);
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
        await rm(outside, { recursive: true, force: true });
      }
    });
  });

  it("does not treat a started record as authorization to finalize", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      try {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("fixture has no state");
        await appendPreflightJournalStarted({
          archiveRoot: paths.archiveRoot,
          filePath: paths.journalPath,
          source,
          assignmentDigest: paths.assignment.assignmentDigest,
          state,
        });
        await expect(readFile(paths.preflightPath, "utf8")).rejects.toThrow(
          /ENOENT/u,
        );
        const result = await runJournaledPreflight({
          source,
          assignment: paths.assignment,
          assignmentPath: paths.assignmentPath,
          archiveRoot: paths.archiveRoot,
          journalPath: paths.journalPath,
          preflightPath: paths.preflightPath,
          segmentRoot: paths.segmentRoot,
          assertLiveSource: () => Promise.resolve(),
          recreateDisposableBoundary: () => Promise.resolve(),
          runState: ({ state, resetRequired }) => {
            expect(resetRequired).toBe(true);
            return Promise.resolve(segmentFor(state));
          },
        });
        expect(result.artifact.segments).toHaveLength(
          source.plan.states.length,
        );
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
