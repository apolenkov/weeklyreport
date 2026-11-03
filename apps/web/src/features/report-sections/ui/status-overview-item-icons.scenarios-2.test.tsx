// @vitest-environment jsdom
import "./status-overview-item-icons.test-support";

// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressIcon } from "./status-overview-item-icons";
describe("ProgressIcon — 1", () => {
  it("uses neutral pause ink while retaining the pause shape", () => {
    const { container } = render(<ProgressIcon status="paused" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-[var(--color-muted-foreground)]",
    );
    expect(container.querySelector("path")?.getAttribute("d")).toBe(
      "M10 9v6M14 9v6",
    );
  });
});
describe("ProgressIcon — 2", () => {
  it.each([
    ["done", "--color-chip-on-track-text"],
    ["in_progress", "--color-status-in-progress-fg"],
    ["planned", "--color-muted-foreground"],
    ["postponed", "--color-muted-foreground"],
    ["wont_do", "--color-muted-foreground"],
  ] as const)("preserves %s ink", (status, token) => {
    const { container } = render(<ProgressIcon status={status} />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      token,
    );
  });
});
