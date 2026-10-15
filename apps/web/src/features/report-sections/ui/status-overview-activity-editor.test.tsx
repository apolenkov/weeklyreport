import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MAX_ACTIVITY_NAME_LENGTH,
  SAFE_TEXT_MAX_LENGTH,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { StatusOverviewActivityEditor } from "./status-overview-activity-editor";

const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderEditor(
  overrides: Partial<{
    onClose: () => void;
    titleOverride: string | null;
    description: string | null;
    onChange: (activityId: string, next: unknown) => void;
  }> = {},
) {
  const onChange = overrides.onChange ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  const rendered = render(
    <StatusOverviewActivityEditor
      activityId={ACTIVITY_ID}
      values={{
        titleOverride: overrides.titleOverride ?? null,
        description: overrides.description ?? null,
        catalogueName: "Catalogue duty",
      }}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  return { onChange, onClose, rerender: rendered.rerender };
}

describe("StatusOverviewActivityEditor", () => {
  it("takes focus when opened, closes after Save and closes on Cancel without saving", async () => {
    const { onChange, onClose } = renderEditor({
      titleOverride: "Weekly duty",
    });
    const user = userEvent.setup();
    expect(
      screen.getByRole("form", { name: "Weekly fields for Catalogue duty" }),
    ).toHaveFocus();

    await user.type(screen.getByTestId(`activity-title-${ACTIVITY_ID}`), "!");
    await user.click(
      screen.getByTestId(`activity-fields-cancel-${ACTIVITY_ID}`),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue(
      "Weekly duty",
    );

    await user.type(screen.getByTestId(`activity-title-${ACTIVITY_ID}`), "?");
    await user.click(screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the weekly override and the catalogue placeholder", () => {
    renderEditor({ titleOverride: "Weekly duty", description: "Ship it" });

    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue(
      "Weekly duty",
    );
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Ship it");
    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveAttribute(
      "placeholder",
      "Catalogue duty",
    );
  });

  it("saves trimmed values and normalizes blanks to null", async () => {
    const { onChange, onClose, rerender } = renderEditor();
    const user = userEvent.setup();

    await user.type(
      screen.getByTestId(`activity-title-${ACTIVITY_ID}`),
      "  Weekly duty  ",
    );
    await user.click(screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`));

    expect(onChange).toHaveBeenCalledWith(ACTIVITY_ID, {
      titleOverride: "Weekly duty",
      description: null,
    });
    rerender(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: "Weekly duty",
          description: null,
          catalogueName: "Catalogue duty",
        }}
        onChange={onChange}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Save weekly fields" }),
    ).toBeDisabled();
    await user.type(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
      "Next description",
    );
    await user.click(
      screen.getByRole("button", { name: "Save weekly fields" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(ACTIVITY_ID, {
      titleOverride: "Weekly duty",
      description: "Next description",
    });
  });

  it("drafts a catalogue reset without discarding the description", async () => {
    const { onChange } = renderEditor({
      titleOverride: "Weekly duty",
      description: "Ship it",
    });
    const user = userEvent.setup();

    await user.click(
      screen.getByTestId(`activity-fields-reset-${ACTIVITY_ID}`),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue("");
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Ship it");

    await user.click(screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`));
    expect(onChange).toHaveBeenCalledWith(ACTIVITY_ID, {
      titleOverride: null,
      description: "Ship it",
    });
  });

  it("cancels a drafted catalogue reset", async () => {
    const { onChange } = renderEditor({
      titleOverride: "Weekly duty",
      description: "Ship it",
    });
    const user = userEvent.setup();

    await user.click(
      screen.getByTestId(`activity-fields-reset-${ACTIVITY_ID}`),
    );
    await user.click(
      screen.getByTestId(`activity-fields-cancel-${ACTIVITY_ID}`),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue(
      "Weekly duty",
    );
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Ship it");
  });

  // TASK-503.22 / C5076: Reset on a title that is already empty changes nothing,
  // so it must not arm the unload guard, report a pending edit or enable Save.
  it("keeps a catalogue reset on an already-empty title clean", async () => {
    const onPendingChange = vi.fn();
    render(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: null,
          description: null,
          catalogueName: "Catalogue duty",
        }}
        onChange={vi.fn()}
        onPendingChange={onPendingChange}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    await user.click(
      screen.getByTestId(`activity-fields-reset-${ACTIVITY_ID}`),
    );

    expect(onPendingChange).not.toHaveBeenCalledWith(ACTIVITY_ID, true);
    expect(
      screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
    ).toBeDisabled();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("keeps an edited description pending when Reset finds the title already empty", async () => {
    const onPendingChange = vi.fn();
    render(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: null,
          description: null,
          catalogueName: "Catalogue duty",
        }}
        onChange={vi.fn()}
        onPendingChange={onPendingChange}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    await user.type(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
      "Ship it",
    );
    await user.click(
      screen.getByTestId(`activity-fields-reset-${ACTIVITY_ID}`),
    );

    expect(onPendingChange).toHaveBeenLastCalledWith(ACTIVITY_ID, true);
    expect(
      screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
    ).toBeEnabled();
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Ship it");
  });

  it("syncs a clean draft before a later one-field save", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: "Old weekly title",
          description: "Old description",
          catalogueName: "Catalogue duty",
        }}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    rerender(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: "Refetched weekly title",
          description: "Refetched description",
          catalogueName: "Catalogue duty",
        }}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    const title = screen.getByTestId(`activity-title-${ACTIVITY_ID}`);
    expect(title).toHaveValue("Refetched weekly title");
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Refetched description");
    expect(
      screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
    ).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();

    await user.clear(title);
    await user.type(title, "Edited weekly title");
    await user.click(screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`));

    expect(onChange).toHaveBeenCalledWith(ACTIVITY_ID, {
      titleOverride: "Edited weekly title",
      description: "Refetched description",
    });
  });

  it.each(["titleOverride", "description"] as const)(
    "blocks submit and Reset after an authoritative %s change without losing pending input",
    async (changedField) => {
      const onChange = vi.fn();
      const onClose = vi.fn();
      const onPendingChange = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <StatusOverviewActivityEditor
          activityId={ACTIVITY_ID}
          values={{
            titleOverride: "Original title",
            description: "Original description",
            catalogueName: "Catalogue duty",
          }}
          onChange={onChange}
          onClose={onClose}
          onPendingChange={onPendingChange}
        />,
      );

      const title = screen.getByTestId(`activity-title-${ACTIVITY_ID}`);
      await user.clear(title);
      await user.type(title, "  Pending title  ");
      const caption = screen.getByText("Weekly fields");

      rerender(
        <StatusOverviewActivityEditor
          activityId={ACTIVITY_ID}
          values={{
            titleOverride: "Original title",
            description: "Original description",
            [changedField]: "Newer server value",
            catalogueName: "Catalogue duty",
          }}
          onChange={onChange}
          onClose={onClose}
          onPendingChange={onPendingChange}
        />,
      );

      const form = screen.getByRole("form");
      const alert = screen.getByRole("alert");
      const save = screen.getByRole("button", { name: "Save weekly fields" });
      expect.soft(alert).not.toBe(caption);
      expect.soft(alert.id).not.toBe("");
      expect.soft(save).toHaveAttribute("aria-describedby", alert.id);
      expect(title).toHaveFocus();
      fireEvent.submit(form);
      expect(onChange).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(title).toHaveValue("  Pending title  ");
      expect(
        screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
      ).toHaveValue("Original description");
      expect(onPendingChange).toHaveBeenLastCalledWith(ACTIVITY_ID, true);
      expect(screen.getByRole("alert")).toHaveTextContent(/changed|stale/i);
      expect(screen.getByRole("alert")).toHaveTextContent(/cancel.*reopen/i);
      expect(screen.getByRole("alert")).toHaveTextContent(
        /cancel.*discard.*local changes/i,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(/reopen.*latest/i);
      expect(
        screen.getByRole("button", { name: "Save weekly fields" }),
      ).toBeDisabled();

      await user.click(
        screen.getByRole("button", { name: "Reset to catalogue name" }),
      );
      expect(title).toHaveValue("");
      expect(screen.getByRole("alert")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Save weekly fields" }),
      ).toBeDisabled();
      fireEvent.submit(form);
      expect(onChange).not.toHaveBeenCalled();
      expect(onPendingChange).toHaveBeenLastCalledWith(ACTIVITY_ID, true);
    },
  );

  it.each([
    {
      name: "catalogue-only rename",
      titleOverride: "Original title",
      description: "Original description",
    },
    {
      name: "trim-equivalent fields",
      titleOverride: " Original title ",
      description: " Original description ",
    },
    {
      name: "blank-equivalent fields",
      titleOverride: "  ",
      description: "\t ",
    },
  ])(
    "allows a pending save after $name",
    async ({ name, titleOverride, description }) => {
      const onChange = vi.fn();
      const onClose = vi.fn();
      const blank = name === "blank-equivalent fields";
      const user = userEvent.setup();
      const { rerender } = render(
        <StatusOverviewActivityEditor
          activityId={ACTIVITY_ID}
          values={{
            titleOverride: blank ? null : "Original title",
            description: blank ? null : "Original description",
            catalogueName: "Catalogue duty",
          }}
          onChange={onChange}
          onClose={onClose}
        />,
      );
      const title = screen.getByTestId(`activity-title-${ACTIVITY_ID}`);
      await user.clear(title);
      await user.type(title, "  Pending title  ");
      rerender(
        <StatusOverviewActivityEditor
          activityId={ACTIVITY_ID}
          values={{
            titleOverride,
            description,
            catalogueName: "Renamed catalogue duty",
          }}
          onChange={onChange}
          onClose={onClose}
        />,
      );
      expect(title).toHaveValue("  Pending title  ");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Save weekly fields" }),
      ).toBeEnabled();
      await user.click(
        screen.getByRole("button", { name: "Save weekly fields" }),
      );
      expect(onChange).toHaveBeenCalledExactlyOnceWith(ACTIVITY_ID, {
        titleOverride: "Pending title",
        description: blank ? null : "Original description",
      });
    },
  );

  it("accepts a 200-character title and a 500-character description", async () => {
    const { onChange } = renderEditor();
    const title = "t".repeat(MAX_ACTIVITY_NAME_LENGTH);
    const description = "d".repeat(SAFE_TEXT_MAX_LENGTH);
    fireEvent.change(screen.getByTestId(`activity-title-${ACTIVITY_ID}`), {
      target: { value: title },
    });
    fireEvent.change(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
      { target: { value: description } },
    );
    await userEvent.click(
      screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
    );

    expect(onChange).toHaveBeenCalledWith(ACTIVITY_ID, {
      titleOverride: title,
      description,
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["activity-title", "activity-description"])(
    "refuses invisible-only %s text and keeps it for correction",
    async (testIdPrefix) => {
      const { onChange } = renderEditor();
      const field = screen.getByTestId(`${testIdPrefix}-${ACTIVITY_ID}`);
      fireEvent.change(field, { target: { value: " \u200B " } });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Text must contain visible characters",
      );
      expect(field).toHaveValue(" \u200B ");
      await userEvent.click(
        screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
      );
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["title", "activity-title", MAX_ACTIVITY_NAME_LENGTH, "Weekly title"],
    [
      "description",
      "activity-description",
      SAFE_TEXT_MAX_LENGTH,
      "Description",
    ],
  ])(
    "blocks an over-limit %s before saving, keeps the text and explains why",
    async (_name, testIdPrefix, limit, label) => {
      const { onChange } = renderEditor();
      const tooLong = "x".repeat(limit + 1);
      const field = screen.getByTestId(`${testIdPrefix}-${ACTIVITY_ID}`);
      fireEvent.change(field, { target: { value: tooLong } });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        `${label} must be ${String(limit)} characters or fewer.`,
      );
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field.getAttribute("aria-describedby")).toContain(alert.id);
      expect(field).toHaveValue(tooLong);

      await userEvent.click(
        screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
      );
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.change(field, { target: { value: "x".repeat(limit) } });
      expect(screen.queryByRole("alert")).toBeNull();
      await userEvent.click(
        screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`),
      );
      expect(onChange).toHaveBeenCalledTimes(1);
    },
  );
});

describe("StatusOverviewActivityEditor dirty state (TASK-503.37 C5073)", () => {
  function renderDirtyProbe(values: {
    titleOverride: string | null;
    description: string | null;
  }) {
    const onPendingChange = vi.fn();
    render(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{ ...values, catalogueName: "Catalogue duty" }}
        onChange={vi.fn()}
        onPendingChange={onPendingChange}
        onClose={vi.fn()}
      />,
    );
    const unloadPrevented = (): boolean => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return { onPendingChange, unloadPrevented };
  }
  const save = () => screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`);
  const title = () => screen.getByTestId(`activity-title-${ACTIVITY_ID}`);
  const description = () =>
    screen.getByTestId(`activity-description-${ACTIVITY_ID}`);

  it("is clean again after typing both fields back to the authoritative values", async () => {
    const { onPendingChange, unloadPrevented } = renderDirtyProbe({
      titleOverride: "Weekly duty",
      description: "Ship it",
    });
    const user = userEvent.setup();

    await user.type(title(), "!");
    await user.type(description(), "?");
    expect(save()).toBeEnabled();
    expect(unloadPrevented()).toBe(true);

    await user.type(title(), "{Backspace}");
    await user.type(description(), "{Backspace}");

    expect(title()).toHaveValue("Weekly duty");
    expect(description()).toHaveValue("Ship it");
    expect(save()).toBeDisabled();
    expect(unloadPrevented()).toBe(false);
    expect(onPendingChange).toHaveBeenLastCalledWith(ACTIVITY_ID, false);
  });

  it("treats whitespace-only text over a null baseline as clean", async () => {
    const { onPendingChange, unloadPrevented } = renderDirtyProbe({
      titleOverride: null,
      description: null,
    });
    const user = userEvent.setup();

    await user.type(title(), " ".repeat(3));
    await user.type(description(), "  ");

    expect(save()).toBeDisabled();
    expect(unloadPrevented()).toBe(false);
    expect(onPendingChange).toHaveBeenLastCalledWith(ACTIVITY_ID, false);
  });
});
