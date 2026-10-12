// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSettings } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.hoisted(() =>
  vi.fn<
    (
      input: unknown,
      options: { readonly onSuccess: () => void | Promise<void> },
    ) => void
  >(),
);

vi.mock("../../../shared/ui/settings/settings-tab", () => ({
  CheckIcon: () => null,
  useUpdateSettingsMut: () => ({ isPending: false, mutate }),
}));

import { PeriodsSubTab } from "./settings-periods-sub-tab";

const SETTINGS: AppSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 5,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 48,
  unifiedActivityView: false,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: "a@example.com",
};

describe("PeriodsSubTab — disabled reopen-window validity", () => {
  beforeEach(() => mutate.mockReset());

  it("saves the disabled policy with the last valid window and revalidates suspended input", async () => {
    const user = userEvent.setup();
    render(<PeriodsSubTab serverSettings={SETTINGS} />);

    const windowInput = screen.getByLabelText("Reopen window (hours)");
    const allowReopen = screen.getByRole("checkbox", {
      name: /allow reopen after publish/i,
    });
    const save = screen.getByRole("button", { name: "Save period policy" });

    fireEvent.change(windowInput, { target: { value: "999" } });
    expect(windowInput).toHaveValue("999");
    expect(save).toBeDisabled();

    await user.click(allowReopen);
    await waitFor(() => expect(save).toBeEnabled());
    expect(windowInput).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(save);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      allowReopenAfterPublish: false,
      reopenWindowHours: 48,
    });

    await user.click(allowReopen);
    await waitFor(() => expect(save).toBeDisabled());
    expect(windowInput).toBeEnabled();
    expect(windowInput).toHaveValue("999");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Whole number between 0 and 168 required",
    );
  });

  it("keeps a non-numeric reopen window visible and blocks Save", () => {
    render(<PeriodsSubTab serverSettings={SETTINGS} />);

    const windowInput = screen.getByLabelText("Reopen window (hours)");
    fireEvent.change(windowInput, { target: { value: "12days" } });

    expect(windowInput).toHaveValue("12days");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Whole number between 0 and 168 required",
    );
    expect(
      screen.getByRole("button", { name: "Save period policy" }),
    ).toBeDisabled();
  });

  it("states the reopen window range in its description", () => {
    render(<PeriodsSubTab serverSettings={SETTINGS} />);

    expect(
      screen.getByLabelText("Reopen window (hours)"),
    ).toHaveAccessibleDescription(/0\.\.168/);
  });

  it("accepts a valid server window after a disabled-policy save", async () => {
    const user = userEvent.setup();
    const rendered = render(<PeriodsSubTab serverSettings={SETTINGS} />);
    const windowInput = screen.getByLabelText("Reopen window (hours)");
    const allowReopen = screen.getByRole("checkbox", {
      name: /allow reopen after publish/i,
    });
    const save = screen.getByRole("button", { name: "Save period policy" });

    fireEvent.change(windowInput, { target: { value: "999" } });
    await user.click(allowReopen);
    await user.click(save);

    const saveOptions = mutate.mock.calls[0]?.[1];
    expect(saveOptions).toBeDefined();
    await act(async () => {
      await saveOptions?.onSuccess();
    });
    rendered.rerender(
      <PeriodsSubTab
        serverSettings={{
          ...SETTINGS,
          allowReopenAfterPublish: false,
          reopenWindowHours: 48,
        }}
      />,
    );

    await waitFor(() => expect(windowInput).toHaveValue("48"));
    await user.click(allowReopen);

    expect(windowInput).toBeEnabled();
    expect(windowInput).toHaveValue("48");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(save).toBeEnabled();
  });

  it("accepts a no-op save when the server keeps the same settings reference", async () => {
    const user = userEvent.setup();
    const initialSettings = { ...SETTINGS, allowReopenAfterPublish: false };
    const rendered = render(<PeriodsSubTab serverSettings={initialSettings} />);
    const windowInput = screen.getByLabelText("Reopen window (hours)");
    const allowReopen = screen.getByRole("checkbox", {
      name: /allow reopen after publish/i,
    });
    const save = screen.getByRole("button", { name: "Save period policy" });

    await user.click(allowReopen);
    fireEvent.change(windowInput, { target: { value: "999" } });
    await user.click(allowReopen);
    await user.click(save);

    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      allowReopenAfterPublish: false,
      reopenWindowHours: 48,
    });
    const saveOptions = mutate.mock.calls[0]?.[1];
    await act(async () => {
      await saveOptions?.onSuccess();
    });
    rendered.rerender(<PeriodsSubTab serverSettings={initialSettings} />);

    await waitFor(() => expect(windowInput).toHaveValue("48"));
    await user.click(allowReopen);
    expect(windowInput).toHaveValue("48");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(save).toBeEnabled();
  });

  it("preserves invalid raw input across a dirty background refetch", () => {
    const rendered = render(<PeriodsSubTab serverSettings={SETTINGS} />);
    const windowInput = screen.getByLabelText("Reopen window (hours)");
    const save = screen.getByRole("button", { name: "Save period policy" });

    fireEvent.change(windowInput, { target: { value: "999" } });
    rendered.rerender(
      <PeriodsSubTab serverSettings={{ ...SETTINGS, reopenWindowHours: 72 }} />,
    );

    expect(windowInput).toHaveValue("999");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Whole number between 0 and 168 required",
    );
    expect(save).toBeDisabled();
  });

  it("preserves invalid raw input in number fields across a refetch", () => {
    const rendered = render(<PeriodsSubTab serverSettings={SETTINGS} />);
    const lengthInput = screen.getByLabelText("Period length (days)");
    const save = screen.getByRole("button", { name: "Save period policy" });

    fireEvent.change(lengthInput, { target: { value: "999" } });
    rendered.rerender(
      <PeriodsSubTab serverSettings={{ ...SETTINGS, periodLengthDays: 14 }} />,
    );

    expect(lengthInput).toHaveValue("999");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Whole number between 1 and 31 required",
    );
    expect(save).toBeDisabled();
  });

  it("includes the unified activity view toggle in the period-policy patch", async () => {
    const user = userEvent.setup();
    render(<PeriodsSubTab serverSettings={SETTINGS} />);

    await user.click(
      screen.getByRole("checkbox", { name: /unified activity view/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save period policy" }),
    );

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      unifiedActivityView: true,
    });
  });
});

describe("Period Policy active validity", () => {
  beforeEach(() => mutate.mockReset());
  it("keeps focus in the field being corrected while another field remains invalid", () => {
    render(<PeriodsSubTab serverSettings={SETTINGS} />);
    const length = screen.getByLabelText("Period length (days)");
    const grace = screen.getByLabelText("Grace period (hours)");
    fireEvent.change(length, { target: { value: "99" } });
    fireEvent.change(grace, { target: { value: "999" } });
    length.focus();
    fireEvent.change(length, { target: { value: "8" } });
    expect(length).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Save period policy" }),
    ).toBeDisabled();
    expect(grace).toHaveAttribute("aria-invalid", "true");
  });
  it("rejects empty deadline time inline and preserves it through a background server update", () => {
    const { rerender } = render(<PeriodsSubTab serverSettings={SETTINGS} />);
    const time = screen.getByLabelText("Deadline time");
    fireEvent.change(time, { target: { value: "" } });
    expect(time).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid time in HH:MM format.",
    );
    const save = screen.getByRole("button", { name: "Save period policy" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mutate).not.toHaveBeenCalled();
    rerender(
      <PeriodsSubTab serverSettings={{ ...SETTINGS, deadlineTime: "19:30" }} />,
    );
    expect(time).toHaveValue("");
    expect(save).toBeDisabled();
    fireEvent.change(time, { target: { value: "02:05" } });
    expect(time).toHaveAttribute("aria-invalid", "false");
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({ deadlineTime: "02:05" });
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
