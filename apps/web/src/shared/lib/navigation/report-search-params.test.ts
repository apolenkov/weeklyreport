import { describe, expect, it } from "vitest";

import { copyReportSearchParams } from "./report-search-params";

describe("report scalar context", () => {
  it("preserves single review intent with author and scope", () => {
    expect(
      copyReportSearchParams(
        new URLSearchParams("authorId=alice&scope=lead&review=1"),
      ).toString(),
    ).toBe("authorId=alice&scope=lead&review=1");
  });
  it.each(["review=1&review=1", "review=1&review=0"])(
    "discards ambiguous intent %s",
    (query) => {
      expect(
        copyReportSearchParams(new URLSearchParams(query)).has("review"),
      ).toBe(false);
    },
  );
});
