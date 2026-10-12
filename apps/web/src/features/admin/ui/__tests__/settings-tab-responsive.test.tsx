import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AppSettings } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "tab=settings",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("../../../organization", () => ({
  IdentitySubTab: () => <div>Identity panel</div>,
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
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.search = "tab=settings";
  });

  it("keeps the canonical working order and complementary breakpoints", () => {
    renderSettings();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Identity",
      "Periods",
      "Reminders",
      "Notifications",
    ]);
    expect(
      screen.getByRole("combobox", { name: "Settings section" }),
    ).toHaveClass("md:hidden", "focus-visible:ring-[var(--color-ring)]");
    expect(screen.getByRole("tablist")).toHaveClass("min-w-max");
    expect(screen.getByRole("tablist").parentElement).toHaveClass(
      "overflow-x-auto",
      "md:block",
    );
  });

  it("uses one compact selector for every working section", () => {
    renderSettings();
    const selector = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Settings section",
    });

    expect(
      within(selector)
        .getAllByRole<HTMLOptionElement>("option")
        .map((option) => option.value),
    ).toEqual(["identity", "periods", "reminders", "notifications"]);

    fireEvent.change(selector, { target: { value: "notifications" } });
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/admin?tab=settings&settingsTab=notifications",
      { scroll: false },
    );
  });

  it("rejects the removed nested AI address", () => {
    navigation.search = "tab=settings&settingsTab=ai";
    renderSettings();

    expect(screen.getByRole("tab", { name: "Identity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("tab", { name: "AI" })).not.toBeInTheDocument();
  });
});
