import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  pollUntil,
  PROJECT_ID,
  REPORT_ID,
  Wrapper,
} from "./__tests__/lead-status-overview.fixtures";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Overview entry start", () => {
  it.each(["current", "next"] as const)(
    "starts a singleton owned stage in %s inline with a clean baseline and keyboard focus return",
    async (week) => {
      const user = userEvent.setup();
      const saveDraft = vi.fn();
      render(
        <Wrapper saveDraft={saveDraft}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );
      const trigger = await screen.findByRole("button", {
        name:
          week === "current"
            ? "Add what happened — Payments, This week"
            : "Plan something — Payments, Next week",
      });
      trigger.focus();
      await user.keyboard("{Enter}");
      const form = await screen.findByRole("form", {
        name: `Add item for Payments, ${week} week`,
      });
      expect(form.closest("[data-overview-create-lane]")).toHaveAttribute(
        "data-overview-create-lane",
        week,
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(form).queryByRole("button", { name: /Stage/ })).toBeNull();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(saveDraft).not.toHaveBeenCalled();
      await pollUntil(() =>
        expect(
          screen.getByRole("button", {
            name: trigger.getAttribute("aria-label") ?? "",
          }),
        ).toHaveFocus(),
      );
    },
  );

  it("retains stage-start input and blocks a stale owned stage through the mounted host", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <Wrapper client={client} saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Plan something — Payments, Next week",
      }),
    );
    const form = await screen.findByRole("form", {
      name: "Add item for Payments, next week",
    });
    await user.type(
      within(form).getByRole("textbox", { name: /What happened…|Plan…/ }),
      "Retained stage work",
    );
    const queryKey = [["leadForm", "byPeriod"], { reportId: REPORT_ID }];
    const loaded = client.getQueryData<{ section: ReportSectionReadModel }>(
      queryKey,
    );
    if (!loaded) throw new Error("Expected a loaded section");
    act(() => {
      client.setQueryData(queryKey, {
        ...loaded,
        section: {
          ...loaded.section,
          version: loaded.section.version + 1,
          projects: loaded.section.projects.map((project) => ({
            ...project,
            ownedStages: [],
          })),
        },
      });
    });
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      within(form).getByRole("textbox", { name: /What happened…|Plan…/ }),
    ).toHaveValue("Retained stage work");
    expect(within(form).getByRole("alert")).toHaveTextContent(/stage/i);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it.each(["foreign", "invalid", "read-only"] as const)(
    "offers no stage start for %s current ownership",
    async (reason) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <Wrapper client={client}>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );
      await screen.findByRole("button", {
        name: "Add what happened — Payments, This week",
      });
      const queryKey = [["leadForm", "byPeriod"], { reportId: REPORT_ID }];
      const loaded = client.getQueryData<{ section: ReportSectionReadModel }>(
        queryKey,
      );
      if (!loaded) throw new Error("Expected a loaded section");
      act(() => {
        client.setQueryData(queryKey, {
          ...loaded,
          readOnly: reason === "read-only",
          section: {
            ...loaded.section,
            version: loaded.section.version + 1,
            projects:
              reason === "foreign"
                ? []
                : loaded.section.projects.map((project) => ({
                    ...project,
                    ownedStages: project.ownedStages.map((stage) => ({
                      ...stage,
                      stageName: "Noncanonical stage",
                    })),
                  })),
          },
        });
      });
      await pollUntil(() =>
        expect(
          screen.queryByRole("button", {
            name: "Add what happened — Payments, This week",
          }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", {
          name: /Add item to .*Noncanonical stage/,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Plan something — Payments, Next week",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("creates a Current item from the Current week Add item and returns focus there on Cancel", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn();
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add what happened — Payments, This week",
      }),
    );

    const form = await screen.findByRole("form", {
      name: "Add item for Payments, current week",
    });
    expect(screen.getAllByRole("form")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      form.closest('[data-overview-create-lane="current"]'),
    ).not.toBeNull();
    expect(
      within(form).getByPlaceholderText("What happened…"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await pollUntil(() =>
      expect(
        screen.queryByRole("form", {
          name: "Add item for Payments, current week",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(saveDraft).not.toHaveBeenCalled();
    await pollUntil(() => {
      const active = document.activeElement;
      expect(
        active instanceof HTMLElement ? active.dataset.overviewFocus : null,
      ).toBe(`add:product:${PROJECT_ID}`);
    });
  });
});
