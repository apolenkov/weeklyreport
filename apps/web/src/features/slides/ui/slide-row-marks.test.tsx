// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StageLegend, StageWatermarks } from "./slide-row-marks";

// A repeated stage (e.g. Testing twice) must not make React warn about
// duplicate keys.
function duplicateKeyWarnings(
  calls: readonly (readonly unknown[])[],
): readonly (readonly unknown[])[] {
  return calls.filter((args) =>
    args.some((arg) => typeof arg === "string" && arg.includes("same key")),
  );
}

describe("slide row stage marks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders repeated stages in the watermarks without duplicate keys", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {
      /* captured for assertions */
    });

    render(
      <StageWatermarks stageNames={["Testing", "Development", "Testing"]} />,
    );

    expect(duplicateKeyWarnings(error.mock.calls)).toEqual([]);
    expect(screen.getByTestId("slide-stage-watermarks").children).toHaveLength(
      3,
    );
  });

  it("renders repeated stages in the legend without duplicate keys", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {
      /* captured for assertions */
    });

    render(<StageLegend stageNames={["Testing", "Development", "Testing"]} />);

    expect(duplicateKeyWarnings(error.mock.calls)).toEqual([]);
    expect(screen.getByTestId("slide-stage-legend").children).toHaveLength(3);
  });
});
