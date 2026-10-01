// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusSlotView } from "./item-status-slot";

describe("StatusSlotView locked slot", () => {
  it("explains the lock in a neutral surface, not the error palette", () => {
    render(
      <StatusSlotView
        slot="locked"
        choices={[]}
        status="planned"
        onSelect={() => undefined}
      />,
    );
    const note = screen.getByText(/Status is set by the covering risk/);
    expect(note.className).toContain("bg-[var(--color-muted)]");
    expect(note.className).not.toContain("blocked");
    expect(note.className).not.toContain("destructive");
  });
});
