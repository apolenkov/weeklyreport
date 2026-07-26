import { describe, expect, it } from "vitest";

import { MS_PER_HOUR } from "../time";
import { isWithinReopenWindow } from "./reopen-window";

const publishedAt = new Date("2026-05-11T09:00:00.000Z");
const windowEnd = publishedAt.getTime() + 72 * MS_PER_HOUR;

describe("isWithinReopenWindow", () => {
  it("is true inside the window", () => {
    expect(
      isWithinReopenWindow(
        72,
        publishedAt,
        publishedAt.getTime() + MS_PER_HOUR,
      ),
    ).toBe(true);
  });

  it("includes the closing instant", () => {
    expect(isWithinReopenWindow(72, publishedAt, windowEnd)).toBe(true);
    expect(isWithinReopenWindow(72, publishedAt, windowEnd + 1)).toBe(false);
  });

  it("treats a zero window as unbounded", () => {
    expect(
      isWithinReopenWindow(0, publishedAt, windowEnd + 10_000 * MS_PER_HOUR),
    ).toBe(true);
  });
});
