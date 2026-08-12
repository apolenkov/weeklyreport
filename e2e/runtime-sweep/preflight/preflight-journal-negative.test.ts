import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import { routeForState } from "./playwright-preflight-support.ts";
import { createPreflightArtifact } from "./preflight-artifact.ts";
import {
  appendPreflightJournalStarted,
  appendPreflightJournalTerminal,
  artifactReaderForFiles,
  assembleCanonicalPreflightSegments,
  createPreflightSegmentArtifact,
  parsePreflightJournalText,
  readPreflightJournal,
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

describe("preflight journal negative boundaries", () => {
  it("fails closed for foreign source/state, plan and assignment drift, chain errors, and byte tamper", async () => {
    await withSource(async (source) => {
      const first = source.plan.states.at(0);
      if (first === undefined) throw new Error("fixture has no source state");
      const root = await mkdtemp(path.join(tmpdir(), "preflight-journal-"));
      try {
        const journalPath = path.join(root, "PREFLIGHT.journal.jsonl");
        const artifactPath = path.join(root, "first.json");
        const firstArtifact = createPreflightSegmentArtifact({
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: first,
          route: routeForState(source, first),
          segment: segmentFor(first),
        });
        await appendPreflightJournalStarted({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: first,
        });
        await writePreflightSegmentArtifact({
          filePath: artifactPath,
          artifact: firstArtifact,
        });
        await appendPreflightJournalTerminal({
          filePath: journalPath,
          source,
          assignmentDigest: ASSIGNMENT_DIGEST,
          state: first,
          status: "PASS",
          segmentDigest: firstArtifact.segmentDigest,
          artifactPath,
          artifactDigest: firstArtifact.artifactDigest,
        });
        const records = await readPreflightJournal(journalPath);
        const firstRecord = records.at(0);
        if (firstRecord === undefined)
          throw new Error("fixture journal has no first record");

        expect(() =>
          validatePreflightJournal({
            source,
            assignmentDigest: "b".repeat(64),
            records,
          }),
        ).toThrow(/assignment digest/u);
        expect(() =>
          validatePreflightJournal({
            source: {
              ...source,
              plan: { ...source.plan, digest: "b".repeat(64) },
            },
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
          }),
        ).toThrow(/plan digest/u);
        expect(() =>
          validatePreflightJournal({
            source: { ...source, sourceSha: "d".repeat(40) },
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
          }),
        ).toThrow(/source SHA/u);

        const foreignRecordBody = {
          ...firstRecord,
          state: { ...firstRecord.state, stateId: "foreign-state" },
        };
        const { recordDigest: _foreignRecordDigest, ...foreignBody } =
          foreignRecordBody;
        expect(() =>
          validatePreflightJournal({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records: [{ ...foreignBody, recordDigest: sha256Hex(foreignBody) }],
          }),
        ).toThrow(/foreign state/u);

        expect(() =>
          parsePreflightJournalText(
            `${records.map((record) => stableSerialize(record)).join("\n")}\n{"truncated":`,
          ),
        ).toThrow(/truncated|Cannot parse/u);
        const tampered = { ...firstRecord, sourceSha: "c".repeat(40) };
        expect(() =>
          parsePreflightJournalText(`${JSON.stringify(tampered)}\n`),
        ).toThrow(/digest does not match/u);
        expect(() =>
          validatePreflightJournal({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records: [...records, firstRecord],
          }),
        ).toThrow(/broken hash chain/u);
        expect(() =>
          validatePreflightJournal({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records: [...records].reverse(),
          }),
        ).toThrow(/sequence|hash chain|reordered/u);

        await expect(
          resolvePreflightResume({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
            readArtifact: ({ record }) =>
              Promise.resolve({
                record,
                segment: {
                  ...segmentFor(first),
                  state: {
                    ...first,
                    pairwiseDigest: sha256Hex({ drifted: true }),
                  },
                },
              }),
          }),
        ).rejects.toThrow(/state digest/u);
        await expect(
          resolvePreflightResume({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
            readArtifact: artifactReaderForFiles(source),
          }),
        ).resolves.toMatchObject({ skipStateIds: [first.stateId] });
        const artifactBytes = await readFile(artifactPath, "utf8");
        const tamperedArtifact = JSON.parse(artifactBytes) as Record<
          string,
          unknown
        >;
        tamperedArtifact.segmentDigest = "e".repeat(64);
        await writeFile(
          artifactPath,
          `${JSON.stringify(tamperedArtifact)}\n`,
          "utf8",
        );
        await expect(
          resolvePreflightResume({
            source,
            assignmentDigest: ASSIGNMENT_DIGEST,
            records,
            readArtifact: artifactReaderForFiles(source),
          }),
        ).rejects.toThrow(/artifact digest|segment digest/u);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  it("requires exact ordered source-plan union before canonical publication", async () => {
    await withSource((source) => {
      const full = source.plan.states.map(segmentFor);
      const first = full.at(0);
      const second = full.at(1);
      if (first === undefined || second === undefined)
        throw new Error("fixture has too few source states");
      expect(
        assembleCanonicalPreflightSegments({
          source,
          segments: [second, first, ...full.slice(2)],
        }).map(({ state }) => state.stateId),
      ).toEqual(source.plan.states.map(({ stateId }) => stateId));
      expect(
        createPreflightArtifact({
          source,
          segments: [second, first, ...full.slice(2)],
        }).segments.map(({ state }) => state.stateId),
      ).toEqual(source.plan.states.map(({ stateId }) => stateId));
      expect(() =>
        assembleCanonicalPreflightSegments({
          source,
          segments: full.slice(1),
        }),
      ).toThrow(/missing state/u);
      expect(() =>
        assembleCanonicalPreflightSegments({
          source,
          segments: [...full, first],
        }),
      ).toThrow(/duplicate state/u);
      expect(() =>
        assembleCanonicalPreflightSegments({
          source,
          segments: full.map((segment, index) =>
            index === 0
              ? {
                  ...segment,
                  state: {
                    ...segment.state,
                    stateId: "foreign-state",
                  },
                }
              : segment,
          ),
        }),
      ).toThrow(/foreign state|missing state/u);
    });
  });
});
