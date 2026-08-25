import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { routeForState } from "../execution/playwright-preflight-support.ts";
import { preflightSessionGroupKey } from "../runtime/preflight-session.ts";
import {
  createPreflightAssignment,
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

const withGroupedSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(
        {
          ...fixture.input,
          seedProfiles: fixture.input.seedProfiles.map(
            ({ profile, definition }) => ({
              profile,
              definition: {
                ...definition,
                capabilities: [
                  ...definition.capabilities,
                  "reopen-flow" as const,
                ],
              },
            }),
          ),
          matrixDeclaration: {
            ...fixture.input.matrixDeclaration,
            axes: {
              ...fixture.input.matrixDeclaration.axes,
              lifecycle: ["open", "reopened"] as const,
            },
          },
        },
        fakeManifestGit(),
      ),
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
    await mkdtemp(path.join(tmpdir(), "preflight-boundary-")),
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

describe("journaled preflight disposable boundary", () => {
  it("resets at launch, reuses adjacent groups, and resets after skipped PASS", async () => {
    await withGroupedSource(async (source) => {
      const groups = source.plan.states.map((state) =>
        preflightSessionGroupKey(state, routeForState(source, state)),
      );
      const firstSameGroupIndex = groups.findIndex(
        (group, index) => index > 0 && group === groups[index - 1],
      );
      if (firstSameGroupIndex < 1)
        throw new Error(
          "Grouped fixture must contain adjacent same-group states",
        );
      const paths = await setup(source);
      const failedStateId = source.plan.states[firstSameGroupIndex]?.stateId;
      if (failedStateId === undefined)
        throw new Error("Grouped fixture has no failure state");
      let failed = false;
      try {
        const firstRunResetFlags: boolean[] = [];
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
            runState: ({ state, resetRequired }) => {
              firstRunResetFlags.push(resetRequired);
              if (state.stateId === failedStateId && !failed) {
                failed = true;
                return Promise.reject(new Error("simulated group failure"));
              }
              return Promise.resolve(segmentFor(state));
            },
          }),
        ).rejects.toThrow(/ended FAIL/u);

        const firstRunGroups = groups.slice(0, firstSameGroupIndex + 1);
        expect(firstRunResetFlags).toEqual(
          firstRunGroups.map(
            (group, index) =>
              index === 0 || group !== firstRunGroups[index - 1],
          ),
        );
        expect(firstRunResetFlags[0]).toBe(true);
        expect(firstRunResetFlags[firstSameGroupIndex]).toBe(false);

        const resumedResetFlags: boolean[] = [];
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
          runState: ({ state, resetRequired }) => {
            resumedResetFlags.push(resetRequired);
            return Promise.resolve(segmentFor(state));
          },
        });
        const rerunGroups = groups.slice(firstSameGroupIndex);
        expect(resumedResetFlags).toEqual(
          rerunGroups.map(
            (group, index) => index === 0 || group !== rerunGroups[index - 1],
          ),
        );
        expect(resumedResetFlags[0]).toBe(true);
        expect(resumed.skippedStateIds).toEqual(
          source.plan.states
            .slice(0, firstSameGroupIndex)
            .map(({ stateId }) => stateId),
        );
        expect(resumed.rerunStateIds).toEqual(
          source.plan.states
            .slice(firstSameGroupIndex)
            .map(({ stateId }) => stateId),
        );
        expect(
          resumed.artifact.segments.map(({ state }) => state.stateId),
        ).toEqual(source.plan.states.map(({ stateId }) => stateId));
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("recreates the boundary before an all-PASS resume and never reruns skipped states", async () => {
    await withSource(async (source) => {
      const paths = await setup(source);
      try {
        await runJournaledPreflight({
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
        await rm(paths.preflightPath, { force: true });

        const orderedEvents: string[] = [];
        const resumed = await runJournaledPreflight({
          source,
          assignment: paths.assignment,
          assignmentPath: paths.assignmentPath,
          archiveRoot: paths.archiveRoot,
          journalPath: paths.journalPath,
          preflightPath: paths.preflightPath,
          segmentRoot: paths.segmentRoot,
          assertLiveSource: () => {
            orderedEvents.push("revalidate");
            return Promise.resolve();
          },
          recreateDisposableBoundary: () => {
            orderedEvents.push("recreate");
            return Promise.resolve();
          },
          runState: ({ state }) => {
            orderedEvents.push("run");
            return Promise.resolve(segmentFor(state));
          },
        });
        expect(orderedEvents.slice(0, 3)).toEqual([
          "revalidate",
          "recreate",
          "revalidate",
        ]);
        expect(orderedEvents).not.toContain("run");
        expect(resumed.skippedStateIds).toEqual(
          source.plan.states.map(({ stateId }) => stateId),
        );

        const failedEvents: string[] = [];
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
              failedEvents.push("revalidate");
              return Promise.resolve();
            },
            recreateDisposableBoundary: () => {
              failedEvents.push("recreate");
              return Promise.reject(new Error("boundary recreation failed"));
            },
            runState: ({ state }) => {
              failedEvents.push("run");
              return Promise.resolve(segmentFor(state));
            },
          }),
        ).rejects.toThrow("boundary recreation failed");
        expect(failedEvents).toEqual(["revalidate", "recreate"]);
      } finally {
        await rm(paths.archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
