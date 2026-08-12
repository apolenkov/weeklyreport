import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import {
  createPreflightAssignment,
  PreflightStateAmbiguousError,
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

describe("ambiguous journaled preflight runner", () => {
  it("records AMBIGUOUS and reruns that entire state on resume", async () => {
    await withSource(async (source) => {
      const archiveRoot = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-ambiguous-")),
      );
      const assignment = createPreflightAssignment(source);
      const assignmentPath = path.join(
        archiveRoot,
        "PREFLIGHT_ASSIGNMENT.json",
      );
      const inputPaths = {
        archiveRoot,
        assignment,
        assignmentPath,
        journalPath: path.join(archiveRoot, "PREFLIGHT.journal.jsonl"),
        preflightPath: path.join(archiveRoot, "PREFLIGHT.json"),
        segmentRoot: path.join(archiveRoot, "segments"),
      } as const;
      await writePreflightAssignment({
        archiveRoot,
        filePath: assignmentPath,
        assignment,
      });
      try {
        let ambiguous = true;
        await expect(
          runJournaledPreflight({
            source,
            ...inputPaths,
            assertLiveSource: () => Promise.resolve(),
            recreateDisposableBoundary: () => Promise.resolve(),
            runState: ({ state }) => {
              if (ambiguous) {
                ambiguous = false;
                return Promise.reject(
                  new PreflightStateAmbiguousError("ambiguous state"),
                );
              }
              return Promise.resolve(segmentFor(state));
            },
          }),
        ).rejects.toThrow(/AMBIGUOUS/u);
        expect(
          (await readPreflightJournal(inputPaths.journalPath)).map(
            ({ status }) => status,
          ),
        ).toEqual(["STARTED", "AMBIGUOUS"]);

        const result = await runJournaledPreflight({
          source,
          ...inputPaths,
          assertLiveSource: () => Promise.resolve(),
          recreateDisposableBoundary: () => Promise.resolve(),
          runState: ({ state, resetRequired }) => {
            expect(resetRequired).toBe(true);
            return Promise.resolve(segmentFor(state));
          },
        });
        expect(result.skippedStateIds).toEqual([]);
        expect(result.rerunStateIds).toEqual(
          source.plan.states.map(({ stateId }) => stateId),
        );
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
