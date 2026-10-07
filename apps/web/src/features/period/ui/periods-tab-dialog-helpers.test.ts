import { describe, expect, it } from "vitest";

import {
  computeDeadlineError,
  dateTimeInputValue,
  nextMonday,
} from "./periods-tab-dialog-helpers";

describe("computeDeadlineError", () => {
  it("accepts a deadline inside the period bounds", () => {
    expect(
      computeDeadlineError({
        deadline: "2026-10-10T12:00",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-18",
      }),
    ).toBeNull();
  });

  it("rejects a deadline before period start", () => {
    expect(
      computeDeadlineError({
        deadline: "2026-10-01T09:00",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-18",
      }),
    ).toBe("Deadline cannot be before period start.");
  });

  it("rejects a deadline after period end", () => {
    expect(
      computeDeadlineError({
        deadline: "2026-10-20T09:00",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-18",
      }),
    ).toBe("Deadline cannot be after period end.");
  });

  it("rejects an unparseable deadline instead of NaN-past-the-bounds", () => {
    expect(
      computeDeadlineError({
        deadline: "not-a-date",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-18",
      }),
    ).toBe("Enter a valid deadline.");
  });
});

describe("nextMonday", () => {
  it("keeps a Monday date on the same day", () => {
    expect(nextMonday(new Date("2026-10-05T12:00:00.000Z"))).toBe("2026-10-05");
  });

  it("rolls a midweek date to the following Monday", () => {
    expect(nextMonday(new Date("2026-10-07T12:00:00.000Z"))).toBe("2026-10-12");
  });
});

describe("dateTimeInputValue", () => {
  it("renders UTC wall-clock for datetime-local", () => {
    expect(dateTimeInputValue(new Date("2026-10-08T15:30:45.123Z"))).toBe(
      "2026-10-08T15:30",
    );
  });
});
