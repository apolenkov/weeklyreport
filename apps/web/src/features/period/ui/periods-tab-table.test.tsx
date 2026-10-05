import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeRow } from "./periods-tab.test-harness";
import { IconButton } from "./periods-tab-icons";
import { PeriodTable } from "./periods-tab-table";

describe("PeriodTable responsive rows", () => {
  it("stacks the week and dates while retaining progress and lifecycle actions", async () => {
    const row = makeRow({
      weekLabel: "Week 19",
      periodStatus: "reopened",
    });
    const onEdit = vi.fn();
    const onPublish = vi.fn();
    render(
      <PeriodTable
        rows={[row]}
        testIdPrefix="active"
        onEdit={onEdit}
        onPublish={onPublish}
        onReopen={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    const record = screen.getByTestId(`periods-active-row-${row.id}`);
    expect(record).toHaveClass("grid", "sm:table-row");
    expect(within(record).getByText("Week 19")).toHaveClass("block");
    expect(record).toHaveTextContent("May 4–10, 2026");
    expect(within(record).getByText("State")).toHaveClass("sm:hidden");
    expect(within(record).getByText("Progress")).toHaveClass("sm:hidden");
    expect(within(record).getByText("Deadline")).toHaveClass("sm:hidden");
    expect(
      screen.getByTestId(`periods-row-${row.id}-progress`),
    ).toHaveTextContent("3/6");
    expect(
      screen.getByTestId(`periods-row-${row.id}-reopened-badge`),
    ).toHaveClass("text-xs");
    expect(screen.getByTestId(`action-delete-${row.id}`)).toBeDisabled();
    await user.click(screen.getByTestId(`action-edit-${row.id}`));
    await user.click(screen.getByTestId(`action-publish-${row.id}`));
    expect(onEdit).toHaveBeenCalledWith(row);
    expect(onPublish).toHaveBeenCalledWith(row);
  });

  it("names the row actions by period dates instead of the raw id", () => {
    const row = makeRow({});
    render(
      <PeriodTable
        rows={[row]}
        testIdPrefix="active"
        onEdit={vi.fn()}
        onPublish={vi.fn()}
        onReopen={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const group = screen.getByRole("group", {
      name: "Actions for May 4–10, 2026",
    });
    expect(group.getAttribute("aria-label")).not.toContain(row.id);
    expect(
      within(group).getByRole("button", {
        name: "Edit period: May 4–10, 2026",
      }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", {
        name: "Publish now: May 4–10, 2026",
      }),
    ).toBeInTheDocument();
  });
});

describe("IconButton (R67)", () => {
  it("is labelled, grows to the touch target on coarse pointers, and is not pale", () => {
    render(
      <IconButton
        testId="icon"
        label="Archive period: Sep 28 – Oct 4, 2026"
        onClick={() => undefined}
        icon={<span />}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Archive period: Sep 28 – Oct 4, 2026",
    });
    expect(button).toHaveAttribute("title", button.getAttribute("aria-label"));
    expect(button).toHaveClass(
      "pointer-coarse:h-[var(--touch-target-min)]",
      "pointer-coarse:w-[var(--touch-target-min)]",
      "text-[var(--color-foreground)]",
    );
    expect(button).not.toHaveClass("text-[var(--color-muted-foreground)]");
  });
});
