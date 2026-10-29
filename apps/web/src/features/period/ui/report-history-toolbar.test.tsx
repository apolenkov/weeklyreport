// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/ui/search/search-input", () => ({
  SearchInput: ({ placeholder }: { readonly placeholder: string }) => (
    <input data-testid="history-search" placeholder={placeholder} />
  ),
}));

import { HistoryToolbar } from "./report-history-toolbar";

function renderToolbar(role: Role | null, onArchiveChange = vi.fn()) {
  const view = render(
    <HistoryToolbar
      role={role}
      includeArchive={false}
      archiveCount={0}
      onArchiveChange={onArchiveChange}
    />,
  );
  return {
    root: view.container.firstElementChild as HTMLElement,
    onArchiveChange,
  };
}

describe("HistoryToolbar loading reserve", () => {
  it("renders the resolved frame, made invisible, before the role is known", () => {
    const { root: loading } = renderToolbar(null);
    const { root: resolved } = renderToolbar("lead");

    expect(loading.className).toBe(`${resolved.className} invisible`);
    for (const token of ["px-3", "py-3", "border", "flex-wrap"])
      expect(loading.className).toContain(token);
    expect(loading.className).not.toContain("min-h-[44px]");
  });

  it("reserves the search slot and the archive toggle without a search", () => {
    const { root: loading } = renderToolbar(null);
    const { root: resolved } = renderToolbar("lead");

    expect(loading.firstElementChild?.className).toBe(
      resolved.firstElementChild?.className,
    );
    expect(loading.querySelector("input[type=checkbox]")).not.toBeNull();
    expect(loading.querySelector("[data-testid=history-search]")).toBeNull();
  });

  it("marks the reserve hidden and inert", () => {
    // jsdom does not implement inert, so this proves the attributes only; real unreachability is a WR-lane check.
    const { root } = renderToolbar(null);

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("inert");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it.each(["lead", "viewer"] as const)(
    "stays interactive and visible for %s",
    (role) => {
      const { root, onArchiveChange } = renderToolbar(role);

      expect(root).not.toHaveAttribute("aria-hidden");
      expect(root).not.toHaveAttribute("inert");
      expect(root.className).not.toContain("invisible");
      expect(root.firstElementChild?.className).toContain(
        "min-h-[var(--touch-target-min)]",
      );
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Show archived reports" }),
      );
      expect(onArchiveChange).toHaveBeenCalledWith(true);
    },
  );

  it("applies focus-within ring styling to the Archive toggle pill label", () => {
    renderToolbar("lead");
    const checkbox = screen.getByRole("checkbox", {
      name: "Show archived reports",
    });
    const label = checkbox.closest("label");
    expect(label).not.toBeNull();
    expect(label?.className).toContain("focus-within:ring-2");
    expect(label?.className).toContain("focus-within:ring-[var(--color-ring)]");
  });
});
