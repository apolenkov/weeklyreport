import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickAddButton } from "./quick-add-button";

describe("QuickAddButton", () => {
  it("the trigger carries no aria-haspopup — a role='group' popup is a disclosure, not a menu", () => {
    render(<QuickAddButton onPick={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    // The popup is a disclosure group, not a menu.
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(trigger);
    expect(
      screen.getByRole("group", { name: "Quick-add record type" }),
    ).toBeInTheDocument();
  });

  it("opens a five-option type picker", () => {
    render(<QuickAddButton onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    const menu = screen.getByRole("group", { name: "Quick-add record type" });
    expect(menu).toBeInTheDocument();
    const options = within(menu).getAllByRole("button");
    expect(options.map((option) => option.textContent)).toEqual([
      "Current week item",
      "Next week item",
      "Blocker",
      "Risk",
      "Decision",
    ]);
  });

  it("fires onPick with the chosen kind and closes the menu", () => {
    const onPick = vi.fn();
    render(<QuickAddButton onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Blocker" }));
    expect(onPick).toHaveBeenCalledWith("blocker");
    expect(
      screen.queryByRole("group", { name: "Quick-add record type" }),
    ).not.toBeInTheDocument();
  });

  it("renders an unavailable kind inert and never fires onPick for it", () => {
    const onPick = vi.fn();
    render(
      <QuickAddButton onPick={onPick} disabledKinds={new Set(["blocker"])} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));

    const blocker = screen.getByRole("button", { name: "Blocker" });
    expect(blocker).toBeDisabled();
    expect(blocker).toHaveAttribute(
      "title",
      expect.stringContaining("Add a product"),
    );
    fireEvent.click(blocker);
    expect(onPick).not.toHaveBeenCalled();

    // Other kinds stay available.
    fireEvent.click(screen.getByRole("button", { name: "Risk" }));
    expect(onPick).toHaveBeenCalledWith("risk");
  });

  it("is inert while disabled (no products)", () => {
    render(<QuickAddButton onPick={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(
      screen.queryByRole("group", { name: "Quick-add record type" }),
    ).not.toBeInTheDocument();
  });

  it("report-toolbar-layout: stays neutral/outline — no resting solid brand-accent fill", () => {
    // Submit Section keeps the single resting brand-accent fill; + Add must
    // never compete with it, so its background stays transparent.
    render(<QuickAddButton onPick={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    expect(trigger.className).toContain("bg-transparent");
    expect(trigger.className).not.toContain(
      "bg-[var(--color-starbucks-accent)]",
    );
  });
});
