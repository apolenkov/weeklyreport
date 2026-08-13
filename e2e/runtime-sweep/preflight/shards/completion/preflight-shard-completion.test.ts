import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { createPreflightShardCompletion } from "./preflight-shard-completion.ts";
import {
  parsePreflightShardCompletion,
  preflightShardCompletionBody,
} from "./preflight-shard-completion-contract.ts";
import { withCompletionFixture } from "./preflight-shard-completion-test-support.ts";

describe("preflight shard completion", () => {
  it("binds one exact fully revalidated shard", async () => {
    await withCompletionFixture((fixture) => {
      const completion = createPreflightShardCompletion(fixture);
      expect(completion.assignedStateIds).toEqual(
        fixture.context.shard.states.map(({ state }) => state.stateId),
      );
      expect(completion.stateEvidence).toHaveLength(
        fixture.context.shard.states.length,
      );
      expect(completion.journalRecordCount).toBe(fixture.records.length);
      expect(completion.journalTailDigest).toBe(
        fixture.records.at(-1)?.recordDigest,
      );
      expect(parsePreflightShardCompletion(completion)).toEqual(completion);
    });
  });

  it("rejects incomplete or extra resume authorization", async () => {
    await withCompletionFixture((fixture) => {
      const ids = fixture.resume.authorizedSkipStateIds;
      const variants = [
        { ...fixture.resume, authorizedSkipStateIds: ids.slice(1) },
        { ...fixture.resume, authorizedSkipStateIds: [...ids, "foreign"] },
        { ...fixture.resume, rerunStateIds: [ids[0] ?? "missing"] },
        { ...fixture.resume, interruptedStateId: ids[0] ?? "missing" },
        { ...fixture.resume, terminalPasses: new Map() },
      ];
      variants.forEach((resume) =>
        expect(() =>
          createPreflightShardCompletion({ ...fixture, resume }),
        ).toThrow(/every assigned state/u),
      );
      const firstId = ids[0];
      const firstPass =
        firstId === undefined
          ? undefined
          : fixture.resume.terminalPasses.get(firstId);
      if (firstId === undefined || firstPass === undefined)
        throw new Error("fixture terminal pass missing");
      const terminalPasses = new Map(fixture.resume.terminalPasses);
      terminalPasses.set(firstId, {
        ...firstPass,
        receipt: { ...firstPass.receipt, receiptDigest: "f".repeat(64) },
      });
      expect(() =>
        createPreflightShardCompletion({
          ...fixture,
          resume: { ...fixture.resume, terminalPasses },
        }),
      ).toThrow(/exact terminal evidence/u);
    });
  });

  it("rejects journal, context, path, digest, and strict-schema drift", async () => {
    await withCompletionFixture((fixture) => {
      expect(() =>
        createPreflightShardCompletion({
          ...fixture,
          records: fixture.records.slice(0, -1),
        }),
      ).toThrow();
      expect(() =>
        createPreflightShardCompletion({
          ...fixture,
          journalPath: `${fixture.journalPath}.foreign`,
        }),
      ).toThrow(/journal path/u);
      expect(() =>
        createPreflightShardCompletion({
          ...fixture,
          archiveRoot: `${fixture.archiveRoot}.foreign`,
        }),
      ).toThrow(/archive root/u);

      const completion = createPreflightShardCompletion(fixture);
      const body = preflightShardCompletionBody(completion);
      const assignedStateIds = body.assignedStateIds.map((stateId, index) =>
        index === 0 ? "foreign-state" : stateId,
      );
      expect(() =>
        parsePreflightShardCompletion({
          ...body,
          assignedStateIds,
          completionDigest: sha256Hex({ ...body, assignedStateIds }),
        }),
      ).toThrow(/assigned state identity/u);
      expect(() =>
        parsePreflightShardCompletion({
          ...completion,
          completionDigest: "f".repeat(64),
        }),
      ).toThrow(/digest/u);
      expect(() =>
        parsePreflightShardCompletion({ ...completion, extra: true }),
      ).toThrow(/Invalid SHARD_COMPLETE/u);
    });
  });
});
