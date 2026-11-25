import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewModel } from "../model/status-overview";
import { StatusOverview } from "./status-overview";

const model: StatusOverviewModel = {
  periods: {
    previouslyPlanned: "24–30 Aug 2026",
    currentWeek: "31 Aug–6 Sep 2026",
    nextWeek: "7–13 Sep 2026",
  },
  previousPlanSource: "published",
  sourceCounts: { previouslyPlanned: 0, currentWeek: 0, nextWeek: 0 },
  units: [],
};

describe("Confirm all as continue", () => {
  it("requires each carried record to receive its own status", () => {
    const onConfirmAll = vi.fn();
    render(
      <StatusOverview
        model={model}
        pendingReviewCount={4}
        onConfirmAll={onConfirmAll}
      />,
    );

    expect(screen.queryByRole("button",{name:/Confirm all/i})).toBeNull();
    expect(onConfirmAll).not.toHaveBeenCalled();
  });

  it("is absent when nothing is pending or it cannot be written", () => {
    const { rerender } = render(
      <StatusOverview
        model={model}
        pendingReviewCount={0}
        onConfirmAll={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Confirm all/ })).toBeNull();

    rerender(<StatusOverview model={model} pendingReviewCount={3} />);
    expect(screen.queryByRole("button", { name: /Confirm all/ })).toBeNull();
  });
});
