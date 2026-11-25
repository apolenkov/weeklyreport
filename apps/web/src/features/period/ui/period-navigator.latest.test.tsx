import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { expect, it, vi } from "vitest";

import { PeriodNavigator } from "./period-navigator";
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/lead/report/demo",
  useSearchParams: () => new URLSearchParams(),
}));
it("announces the next opening date without navigating at the latest week", async () => {
  const notify = vi.spyOn(toast, "info");
  render(
    <PeriodNavigator
      explainLatest
      currentPeriodId="demo"
      periods={[
        {
          id: "demo",
          sourceSectionId: "demo-section",
          periodStart: new Date("2026-08-31T00:00:00Z"),
          weekLabel: "Week 36",
          dateRange: "31 Aug–6 Sep 2026",
          isCurrent: true,
          isSubmitted: false,
        },
      ]}
    />,
  );
  const next = screen.getByRole("button", { name: "Next period" });
  expect(next).toHaveAttribute("aria-disabled", "true");
  const reason =
    "This is the latest week. The next report opens on 7 Sept 2026";
  expect(next).toHaveAccessibleDescription(reason);
  await userEvent.click(next);
  expect(notify).toHaveBeenCalledWith(reason);
  expect(push).not.toHaveBeenCalled();
});
