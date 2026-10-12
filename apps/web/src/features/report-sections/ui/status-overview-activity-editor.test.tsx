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
  render(
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
  return { onChange, onClose };
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
    const { onChange } = renderEditor();
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

    await user.clear(title);
    await user.type(title, "Edited weekly title");
    await user.click(screen.getByTestId(`activity-fields-save-${ACTIVITY_ID}`));

    expect(onChange).toHaveBeenCalledWith(ACTIVITY_ID, {
      titleOverride: "Edited weekly title",
      description: "Refetched description",
    });
  });

  it("keeps pending input when server values rerender", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: null,
          description: null,
          catalogueName: "Catalogue duty",
        }}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByTestId(`activity-title-${ACTIVITY_ID}`),
      "Pending title",
    );
    await user.type(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
      "Pending description",
    );

    rerender(
      <StatusOverviewActivityEditor
        activityId={ACTIVITY_ID}
        values={{
          titleOverride: "Older server title",
          description: "Older server description",
          catalogueName: "Catalogue duty",
        }}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId(`activity-title-${ACTIVITY_ID}`)).toHaveValue(
      "Pending title",
    );
    expect(
      screen.getByTestId(`activity-description-${ACTIVITY_ID}`),
    ).toHaveValue("Pending description");
  });

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
