import { describe, expect, it } from "vitest";

import { decodeArchiveCursor, encodeArchiveCursor } from "./archive-cursor.js";

describe("archive keyset cursor", () => {
  it("round-trips a (publishedAt, id) coordinate", () => {
    const publishedAt = new Date("2026-04-08T10:00:00.000Z");
    const id = "22222222-2222-4222-8222-222222222222";

    const decoded = decodeArchiveCursor(encodeArchiveCursor(publishedAt, id));

    expect(decoded).toEqual({ publishedAt, id });
  });

  it("returns null for a token missing the separator", () => {
    const noSeparator = Buffer.from("no-separator-here", "utf8").toString(
      "base64",
    );
    expect(decodeArchiveCursor(noSeparator)).toBeNull();
  });

  it("returns null for an unparseable date half", () => {
    const badDate = Buffer.from("not-a-date|some-id", "utf8").toString(
      "base64",
    );
    expect(decodeArchiveCursor(badDate)).toBeNull();
  });

  it("returns null for an empty id half", () => {
    const emptyId = Buffer.from("2026-04-08T10:00:00.000Z|", "utf8").toString(
      "base64",
    );
    expect(decodeArchiveCursor(emptyId)).toBeNull();
  });

  it("never throws on arbitrary garbage input", () => {
    expect(() => decodeArchiveCursor("!!!not base64!!!")).not.toThrow();
  });
});
