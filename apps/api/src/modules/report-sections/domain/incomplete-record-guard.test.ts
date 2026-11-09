import { describe, expect, it } from "vitest";

import {
  findIncompleteRecordViolation,
  type PersistedRecord,
} from "./incomplete-record-guard.js";

const id = (suffix: number) =>
  `10000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const DRAFT_RISK = id(1);
const DRAFT_DECISION = id(2);
const COMPLETE_RISK = id(3);

const PERSISTED: readonly PersistedRecord[] = [
  { kind: "risk", stableId: DRAFT_RISK, complete: false },
  { kind: "decision", stableId: DRAFT_DECISION, complete: false },
  { kind: "risk", stableId: COMPLETE_RISK, complete: true },
];

const keep = (risks: string[], decisions: string[] = []) => ({
  risks: risks.map((stableId) => ({ stableId })),
  decisions: decisions.map((stableId) => ({ stableId })),
});

const code = (...args: Parameters<typeof findIncompleteRecordViolation>) =>
  findIncompleteRecordViolation(...args)?.code ?? null;

describe("incomplete record replacement guard", () => {
  it("accepts a replacement that keeps every incomplete record", () => {
    expect(
      code(PERSISTED, keep([DRAFT_RISK], [DRAFT_DECISION]), []),
    ).toBeNull();
  });

  it("lets a complete record leave by omission", () => {
    expect(
      code(
        [{ kind: "risk", stableId: COMPLETE_RISK, complete: true }],
        keep([]),
        [],
      ),
    ).toBeNull();
  });

  it("rejects an old client's replacement that omits an incomplete record", () => {
    expect(code(PERSISTED, keep([COMPLETE_RISK], [DRAFT_DECISION]), [])).toBe(
      "INCOMPLETE_RECORD_OMITTED",
    );
    expect(code(PERSISTED, keep([DRAFT_RISK]), [])).toBe(
      "INCOMPLETE_RECORD_OMITTED",
    );
  });

  it("ignores new records that carry no stable identity yet", () => {
    expect(
      code([], { risks: [{ stableId: undefined }], decisions: [{}] }, []),
    ).toBeNull();
  });

  it("deletes exactly the incomplete record an intent names", () => {
    expect(
      code(PERSISTED, keep([COMPLETE_RISK], [DRAFT_DECISION]), [
        { kind: "risk", stableId: DRAFT_RISK },
      ]),
    ).toBeNull();
  });

  it("still rejects another incomplete record omitted beside a deletion", () => {
    expect(
      code(PERSISTED, keep([]), [{ kind: "risk", stableId: DRAFT_RISK }]),
    ).toBe("INCOMPLETE_RECORD_OMITTED");
  });

  it("matches a deletion by kind as well as identity", () => {
    expect(
      code(PERSISTED, keep([], [DRAFT_DECISION]), [
        { kind: "decision", stableId: DRAFT_RISK },
      ]),
    ).toBe("INCOMPLETE_RECORD_DELETION_INVALID");
  });

  it.each([
    ["a record of another section or none at all", id(99)],
    ["a complete record", COMPLETE_RISK],
  ])("rejects a deletion naming %s", (_label, stableId) => {
    expect(
      code(PERSISTED, keep([DRAFT_RISK], [DRAFT_DECISION]), [
        { kind: "risk", stableId },
      ]),
    ).toBe("INCOMPLETE_RECORD_DELETION_INVALID");
  });

  it("rejects a record both kept and deleted, and a repeated deletion", () => {
    const intent = { kind: "risk", stableId: DRAFT_RISK } as const;

    expect(
      code(PERSISTED, keep([DRAFT_RISK], [DRAFT_DECISION]), [intent]),
    ).toBe("INCOMPLETE_RECORD_DELETION_INVALID");
    expect(code(PERSISTED, keep([], [DRAFT_DECISION]), [intent, intent])).toBe(
      "INCOMPLETE_RECORD_DELETION_INVALID",
    );
  });
});
