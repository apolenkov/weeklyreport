import { describe, expect, it } from "vitest";

import {
  parsePublishedSnapshot,
  publishedSnapshotFailure,
  PublishedSnapshotIntegrityError,
  requirePublishedSnapshot,
} from "./published-snapshot.js";

const reportId = "00000001-0000-4000-8000-000000000000";

// An accessor exercises the parser's genuine exceptional input boundary;
// ordinary persisted JSON cannot itself throw while a property is read.
const throwingSnapshot = (error: unknown) => ({
  get reportId(): string {
    throw error;
  },
});

describe("published snapshot public failure contracts", () => {
  it.each([
    [undefined, "Published snapshot integrity failure: missing"],
    [
      reportId,
      `Published snapshot integrity failure for report ${reportId}: missing`,
    ],
  ])("formats an explicit failure for report %s", (id, message) => {
    const error = publishedSnapshotFailure(id, "missing");
    expect(error).toBeInstanceOf(PublishedSnapshotIntegrityError);
    expect(error.name).toBe("PublishedSnapshotIntegrityError");
    expect(error.message).toBe(message);
  });

  it.each([
    [
      new Error("broken"),
      undefined,
      "Published snapshot integrity failure: broken",
    ],
    [
      new Error("broken"),
      reportId,
      `Published snapshot integrity failure for report ${reportId}: broken`,
    ],
    [new Error(""), undefined, "Published snapshot integrity failure: "],
    [
      new Error(""),
      reportId,
      `Published snapshot integrity failure for report ${reportId}: `,
    ],
    ["non-Error", undefined, "Published snapshot integrity failure"],
    [
      "non-Error",
      reportId,
      `Published snapshot integrity failure for report ${reportId}`,
    ],
  ])(
    "preserves the message of throwable %j for report %s",
    (error, id, message) => {
      expect(() =>
        requirePublishedSnapshot(throwingSnapshot(error), id),
      ).toThrow(new PublishedSnapshotIntegrityError(message));
    },
  );

  it.each([null, undefined])(
    "keeps nullable parsing separate from mandatory consumption: %s",
    (value) => {
      expect(parsePublishedSnapshot(value)).toBeNull();
      expect(() => requirePublishedSnapshot(value, reportId)).toThrow(
        new PublishedSnapshotIntegrityError(
          `Published snapshot integrity failure for report ${reportId}: snapshot is absent.`,
        ),
      );
    },
  );

  it("passes an existing integrity error through by object identity", () => {
    const original = publishedSnapshotFailure(reportId, "already diagnosed");
    try {
      requirePublishedSnapshot(throwingSnapshot(original), reportId);
      expect.unreachable("Mandatory consumption must fail");
    } catch (error) {
      expect(error).toBe(original);
    }
  });
});
