import type { AppSettings } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NumberField } from "./settings-periods-field-controls";
import { PeriodBaseFields } from "./settings-periods-fields-base";
import { parseIntegerInBounds } from "./settings-periods-fields-base-helpers";

const SETTINGS: AppSettings = {
  autoCreatePeriods: true,
  defaultDeadlineDays: 3,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: false,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 4,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 48,
  unifiedActivityView: false,
  defaultTimezone: "UTC",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: null,
};

function FieldsHarness() {
  const [draft, setDraft] = useState(SETTINGS);
  return <PeriodBaseFields draft={draft} setDraft={setDraft} />;
}

describe("parseIntegerInBounds", () => {
  const signedBounds = { min: -10, max: 10 } as const;

  it.each([
    ["", null],
    [" ".repeat(3), null],
    ["+", null],
    ["-", null],
    ["1.5", null],
    ["1e2", null],
    ["12days", null],
    ["days12", null],
  ])("rejects non-integer input %j", (raw, expected) => {
    expect(parseIntegerInBounds(raw, signedBounds)).toBe(expected);
  });

  it.each([
    ["-7", -7],
    ["+7", 7],
    [" 7 ", 7],
  ])("accepts a trimmed signed integer %j", (raw, expected) => {
    expect(parseIntegerInBounds(raw, signedBounds)).toBe(expected);
  });
});

describe("NumberField", () => {
  it("rejects decimal input without committing a truncated value", () => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();

    render(
      <NumberField
        id="period-length-days"
        label="Period length (days)"
        bounds={{ min: 1, max: 31 }}
        value={7}
        onChange={onChange}
        onValidityChange={onValidityChange}
        hint="How many days each period spans"
      />,
    );

    fireEvent.change(screen.getByLabelText("Period length (days)"), {
      target: { value: "1.5" },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(onValidityChange).toHaveBeenLastCalledWith(
      "period-length-days",
      false,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Whole number between 1 and 31 required",
    );
    expect(screen.getByLabelText("Period length (days)")).toHaveAttribute(
      "aria-describedby",
      "period-length-days-error",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "period-length-days-error",
    );
  });
});

describe("PeriodBaseFields", () => {
  it.each([
    ["Period length (days)", 1, 31],
    ["Default deadline days", 1, 30],
    ["Grace period (hours)", 0, 168],
    ["Auto-archive published periods after (weeks)", 0, 52],
  ])(
    "%s does not silently clamp out-of-range input to a fallback; it flags it",
    (label, min, maximum) => {
      render(<FieldsHarness />);
      const input = screen.getByLabelText(label);

      fireEvent.change(input, { target: { value: "999" } });

      // The raw invalid text is retained and a validation error surfaces
      // instead of the value silently snapping to the bounds maximum.
      expect(input).toHaveValue(999);
      expect(screen.getByRole("alert")).toHaveTextContent(
        `Whole number between ${min} and ${maximum} required`,
      );
    },
  );

  it("accepts a valid integer within bounds and reports validity", () => {
    render(<FieldsHarness />);
    const input = screen.getByLabelText("Period length (days)");

    fireEvent.change(input, { target: { value: "14" } });

    expect(input).toHaveValue(14);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
