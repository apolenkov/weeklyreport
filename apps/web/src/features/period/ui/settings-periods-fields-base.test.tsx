import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { AdminSettingsView } from "../../admin";
import { PeriodBaseFields } from "./settings-periods-fields-base";

const SETTINGS: AdminSettingsView = {
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

describe("PeriodBaseFields", () => {
  it.each([
    ["Period length (days)", 31],
    ["Default deadline days", 30],
    ["Grace period (hours)", 168],
    ["Auto-archive published periods after (weeks)", 52],
  ])("clamps %s to its declared maximum", (label, maximum) => {
    render(<FieldsHarness />);
    const input = screen.getByLabelText(label);

    fireEvent.change(input, { target: { value: "999" } });

    expect(input).toHaveValue(maximum);
  });
});
