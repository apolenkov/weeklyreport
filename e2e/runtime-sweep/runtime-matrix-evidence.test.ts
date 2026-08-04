import { describe, expect, it } from "vitest";

import { eventCounts, hasRuntimeFailures } from "./runtime-event-summary.ts";

describe("runtime matrix event evidence", () => {
  it("summarizes console, page, and request failures without dropping a channel", () => {
    const events = {
      consoleMessages: [{ type: "warning", text: "warning" }],
      pageErrors: [],
      requestFailures: [{ url: "/trpc/report", failure: "aborted" }],
    } as const;

    expect(eventCounts(events)).toEqual({
      consoleMessages: 1,
      pageErrors: 0,
      requestFailures: 1,
    });
    expect(hasRuntimeFailures(events)).toBe(true);
  });

  it("keeps a clean event window clean", () => {
    const events = {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [],
    } as const;

    expect(eventCounts(events)).toEqual({
      consoleMessages: 0,
      pageErrors: 0,
      requestFailures: 0,
    });
    expect(hasRuntimeFailures(events)).toBe(false);
  });
});
