import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, expect, it, vi } from "vitest";

import {
  echoSaveDraft,
  openMoveMenu,
  REPORT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
  "focuses the confirmed destination and keeps the phone tab until Show (phone %s)",
  async (phone) => {
    if (phone)
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(private readonly callback: ResizeObserverCallback) {}
          observe(target: Element) {
            if (target.classList.contains("overview-table"))
              this.callback(
                [{ contentRect: { width: 375 } }] as ResizeObserverEntry[],
                this,
              );
          }
          unobserve = vi.fn();
          disconnect = vi.fn();
        },
      );
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    render(
      <Wrapper saveDraft={echoSaveDraft()}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(await openMoveMenu("Current work", "next week"));
    await waitFor(() =>
      expect(
        success.mock.calls.find(
          ([message]) => message === "Moved to Next week.",
        )?.[1],
      ).toMatchObject({ action: { label: "Undo" } }),
    );
    if (phone) {
      expect(screen.getByRole("tab", { name: "This week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const show = success.mock.calls.find(
        ([message]) => message === "Moved to Next week.",
      )?.[1]?.cancel;
      if (!show || typeof show !== "object" || !("onClick" in show))
        throw new Error("Missing Show action");
      render(<button onClick={show.onClick}>Show destination</button>);
      await user.click(
        screen.getByRole("button", { name: "Show destination" }),
      );
      expect(screen.getByRole("tab", { name: "Next week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Edit text: Current work, Next week",
        }),
      ).toHaveFocus(),
    );
  },
);
