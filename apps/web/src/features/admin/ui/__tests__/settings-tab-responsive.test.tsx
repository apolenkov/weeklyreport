import "@testing-library/jest-dom/vitest";

import type { AppSettings } from "@customreport/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../organization", () => ({
  IdentitySubTab: () => <div>Identity panel</div>,
  IntegrationsSubTab: () => <div>Integrations panel</div>,
  NotificationsSubTab: () => <div>Notifications panel</div>,
}));
vi.mock("../../../period", () => ({
  PeriodsSubTab: () => <div>Periods panel</div>,
}));
vi.mock("../reminders/settings-reminders-sub-tab", () => ({
  RemindersSubTab: () => <div>Reminders panel</div>,
}));
vi.mock("../../../../shared/ui/tabs/tab-header", () => ({
  TabHeader: () => <h2>Settings</h2>,
}));

import { SettingsTab } from "../settings-tab";

const SETTINGS: AppSettings = {
  allowLateSubmissions: true,
  allowReopenAfterPublish: true,
  autoArchiveWeeksAfterPublish: 0,
  autoCreatePeriods: false,
  autoPublishAfterDeadline: false,
  deadlineTime: "18:00",
  defaultDeadlineDays: 5,
  defaultReminderAudience: "lead-with-draft",
  defaultTimezone: "Europe/Moscow",
  gracePeriodHours: 24,
  notificationFromEmail: null,
  periodLengthDays: 7,
  reopenWindowHours: 72,
  unifiedActivityView: false,
  workingDays: "mon-fri",
};

function renderSettings() {
  render(<SettingsTab settings={SETTINGS} />);
}

describe("SettingsTab responsive navigation", () => {
  it("keeps the canonical working order and complementary breakpoints", () => {
    renderSettings();

    expect(
      screen
        .getAllByRole("tab")
        .map((tab) => tab.textContent.replace("Coming Soon", "")),
    ).toEqual([
      "Identity",
      "Periods",
      "Reminders",
      "Notifications",
      "Integrations",
      "Holidays",
    ]);
    expect(
      screen.getByRole("combobox", { name: "Settings section" }),
    ).toHaveClass("md:hidden", "focus-visible:ring-[var(--color-ring)]");
    expect(screen.getByRole("tablist")).toHaveClass("hidden", "md:inline-flex");
  });

  it("uses one compact selector for every working section and rejects Holidays", () => {
    renderSettings();
    const selector = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Settings section",
    });

    expect(
      within(selector)
        .getAllByRole<HTMLOptionElement>("option")
        .map((option) => option.value),
    ).toEqual([
      "identity",
      "periods",
      "reminders",
      "notifications",
      "integrations",
    ]);

    fireEvent.change(selector, { target: { value: "notifications" } });
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.change(selector, { target: { value: "holidays" } });
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps both Holidays traces explicit while only the wide one is focusable", () => {
    renderSettings();

    const mobileTrace = screen.getByTestId("mobile-holidays-coming-soon");
    expect(mobileTrace).toHaveAttribute("aria-disabled", "true");
    expect(mobileTrace).toHaveClass("w-full");
    expect(within(mobileTrace).getByText("Coming Soon")).toHaveAttribute(
      "data-state",
      "coming-soon",
    );

    const holidaysTab = screen.getByRole("tab", { name: /coming soon/i });
    expect(holidaysTab).toHaveAttribute("aria-disabled", "true");
    expect(holidaysTab).not.toBeDisabled();
  });

  it("keeps the wide Holidays tooltip reachable without activating the tab", async () => {
    renderSettings();
    const identityTab = screen.getByRole("tab", { name: "Identity" });
    const holidaysTab = screen.getByRole("tab", { name: /coming soon/i });
    const before = screen.getAllByText("Coming Soon").length;

    fireEvent.mouseDown(holidaysTab);
    fireEvent.click(holidaysTab);
    fireEvent.focus(holidaysTab);
    fireEvent.keyDown(holidaysTab, { key: "Enter" });
    fireEvent.keyDown(holidaysTab, { key: " " });
    expect(identityTab).toHaveAttribute("aria-selected", "true");
    expect(holidaysTab.getAttribute("aria-selected")).not.toBe("true");

    await userEvent.setup().hover(screen.getByTestId("holidays-coming-soon"));
    await waitFor(() => {
      expect(screen.getAllByText("Coming Soon")).toHaveLength(before + 1);
    });
  });
});
