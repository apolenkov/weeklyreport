import {
  appendFile,
  readFile,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  appendPreflightShardJournalStarted,
  appendPreflightShardJournalTerminal,
  parsePreflightShardJournalText,
  preflightShardJournalPathFor,
  readPreflightShardJournal,
} from "./preflight-shard-journal-io.ts";
import {
  parsePreflightShardStateReceipt,
  preflightShardStateReceiptBody,
} from "./preflight-shard-receipt-contract.ts";
import { withReceiptFixture } from "./preflight-shard-receipt-test-support.ts";
import {
  readPreflightShardStateReceipt,
  writePreflightShardStateReceipt,
} from "./preflight-shard-state-receipt.ts";

describe("preflight shard receipt and JSONL I/O", () => {
  it("round-trips canonical receipt and segment bytes", async () => {
    await withReceiptFixture(async (fixture) => {
      const revalidated = await readPreflightShardStateReceipt({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath: fixture.receiptPath,
        state: fixture.state,
        started: fixture.started,
      });
      expect(revalidated.receipt.startedRecordDigest).toBe(
        fixture.started.recordDigest,
      );
      expect(revalidated.segment.state.stateId).toBe(
        fixture.state.state.stateId,
      );
      await expect(
        writePreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          receipt: revalidated.receipt,
        }),
      ).rejects.toThrow(/Cannot create immutable/u);
    });
  });

  it("appends one canonical record and rejects truncated or blank JSONL", async () => {
    await withReceiptFixture(async (fixture) => {
      const filePath = preflightShardJournalPathFor(fixture.context);
      const started = await appendPreflightShardJournalStarted({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath,
        state: fixture.state,
      });
      const afterStarted = await readFile(filePath, "utf8");
      expect(parsePreflightShardJournalText(afterStarted)).toEqual([started]);
      await appendPreflightShardJournalTerminal({
        context: fixture.context,
        archiveRoot: fixture.archiveRoot,
        filePath,
        status: "PASS",
        receiptPath: fixture.receiptPath,
      });
      expect((await readFile(filePath, "utf8")).startsWith(afterStarted)).toBe(
        true,
      );
      expect(
        await readPreflightShardJournal({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath,
        }),
      ).toHaveLength(2);
      expect(() =>
        parsePreflightShardJournalText(afterStarted.trimEnd()),
      ).toThrow(/truncated/u);
      expect(() => parsePreflightShardJournalText(`${afterStarted}\n`)).toThrow(
        /blank/u,
      );
      expect(() => parsePreflightShardJournalText(` ${afterStarted}`)).toThrow(
        /not canonical/u,
      );
    });
  });

  it("rejects non-canonical receipt bytes and a journal outside its exact path", async () => {
    await withReceiptFixture(async (fixture) => {
      const receipt = await readFile(fixture.receiptPath, "utf8");
      await writeFile(fixture.receiptPath, ` ${receipt}`, "utf8");
      await expect(
        readPreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          state: fixture.state,
          started: fixture.started,
        }),
      ).rejects.toThrow(/bytes are not canonical/u);
      await expect(
        readPreflightShardJournal({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: `${preflightShardJournalPathFor(fixture.context)}.other`,
        }),
      ).rejects.toThrow(/path does not match/u);
      await appendFile(fixture.receiptPath, "", "utf8");
    });
  });

  it("rejects self-consistent context and segment binding drift", async () => {
    await withReceiptFixture(async (fixture) => {
      const original = parsePreflightShardStateReceipt(
        JSON.parse(await readFile(fixture.receiptPath, "utf8")),
      );
      const withDigest = (
        mutate: (
          body: ReturnType<typeof preflightShardStateReceiptBody>,
        ) => ReturnType<typeof preflightShardStateReceiptBody>,
      ) => {
        const body = mutate(preflightShardStateReceiptBody(original));
        return { ...body, receiptDigest: sha256Hex(body) };
      };
      const foreign = withDigest((body) => ({ ...body, donorId: "Air" }));
      await expect(
        writePreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: `${fixture.receiptPath}.foreign`,
          receipt: foreign,
        }),
      ).rejects.toThrow(/context|path/u);

      const foreignSegmentPath = withDigest((body) => ({
        ...body,
        segmentArtifactPath: `${body.segmentArtifactPath}.foreign`,
      }));
      await expect(
        writePreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          receipt: foreignSegmentPath,
        }),
      ).rejects.toThrow(/segment path/u);

      const stale = withDigest((body) => ({
        ...body,
        segmentArtifactDigest: sha256Hex("foreign segment"),
      }));
      await writeFile(
        fixture.receiptPath,
        `${stableSerialize(stale)}\n`,
        "utf8",
      );
      await expect(
        readPreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          state: fixture.state,
          started: fixture.started,
        }),
      ).rejects.toThrow(/stale segment binding/u);
    });
  });

  it("rejects non-canonical segment bytes and symlinked receipt paths", async () => {
    await withReceiptFixture(async (fixture) => {
      const receipt = parsePreflightShardStateReceipt(
        JSON.parse(await readFile(fixture.receiptPath, "utf8")),
      );
      const segmentText = await readFile(receipt.segmentArtifactPath, "utf8");
      await writeFile(receipt.segmentArtifactPath, ` ${segmentText}`, "utf8");
      await expect(
        readPreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          state: fixture.state,
          started: fixture.started,
        }),
      ).rejects.toThrow(/bytes are not canonical/u);

      const retainedPath = `${fixture.receiptPath}.retained`;
      await rename(fixture.receiptPath, retainedPath);
      await symlink(retainedPath, fixture.receiptPath);
      await expect(
        readPreflightShardStateReceipt({
          context: fixture.context,
          archiveRoot: fixture.archiveRoot,
          filePath: fixture.receiptPath,
          state: fixture.state,
          started: fixture.started,
        }),
      ).rejects.toThrow(/must not be a symlink/u);
    });
  });
});
