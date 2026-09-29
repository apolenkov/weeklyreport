// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { LeadForm } from "./lead-form";
import { buildLeadLoadHarness } from "./lead-form-load-test-harness";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

describe("LeadForm local add navigation", () => {
  it("closes report A's item dialog when report B loads without saving", async () => {
    const reportA = makeLeadFormSectionFixture({
      reportId: "10000000-0000-4000-8000-00000000000a",
      reportSectionId: "20000000-0000-4000-8000-00000000000a",
      projects: [
        {
          projectId: "30000000-0000-4000-8000-00000000000a",
          projectName: "Report A product",
          trafficLight: null,
        },
      ],
    });
    const reportB = makeLeadFormSectionFixture({
      reportId: "10000000-0000-4000-8000-00000000000b",
      reportSectionId: "20000000-0000-4000-8000-00000000000b",
      projects: [
        {
          projectId: "30000000-0000-4000-8000-00000000000b",
          projectName: "Report B product",
          trafficLight: null,
        },
      ],
    });
    const { Wrapper, queryClient } = buildLeadLoadHarness({
      byPeriodQueryFn: (input) =>
        (input as { reportId: string }).reportId === reportA.reportId
          ? {
              section: reportA,
              readOnly: false,
              canRequestReopen: false,
              publishedLineage: { itemStableIds: [], decisionStableIds: [] },
            }
          : {
              section: reportB,
              readOnly: false,
              canRequestReopen: false,
              publishedLineage: { itemStableIds: [], decisionStableIds: [] },
            },
    });
    const rendered = render(<LeadForm reportId={reportA.reportId} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findAllByText("Report A product")).not.toHaveLength(0);
    fireEvent.click(
      expectDefined(screen.getAllByRole("button", { name: "+ Add Item" })[0]),
    );
    expect(
      await screen.findByRole("dialog", { name: /^Add Item/ }),
    ).toBeInTheDocument();

    rendered.rerender(<LeadForm reportId={reportB.reportId} />);

    expect(await screen.findAllByText("Report B product")).not.toHaveLength(0);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /^Add Item/ }),
      ).not.toBeInTheDocument(),
    );
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
  });

  it("uses a refetch-only version bump for the next fill-from without autosaving", async () => {
    const sourceSectionId = "90000000-0000-4000-8000-000000000001";
    let serverVersion = 1;
    const section = () =>
      makeLeadFormSectionFixture({
        version: serverVersion,
        projects: [
          {
            projectId: "30000000-0000-4000-8000-000000000001",
            projectName: "Versioned report product",
            trafficLight: null,
          },
        ],
      });
    const { Wrapper, queryClient, sectionQuery } = buildLeadLoadHarness({
      byPeriodQueryFn: () => ({
        section: section(),
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
      historyQueryFn: () => ({
        items: [
          {
            sectionId: sourceSectionId,
            reportId: "90000000-0000-4000-8000-000000000002",
            periodStart: new Date("2026-06-08T00:00:00Z"),
            periodEnd: new Date("2026-06-14T00:00:00Z"),
            reportStatus: "published",
            sectionStatus: "submitted",
            submittedAt: new Date("2026-06-13T10:00:00Z"),
            publishedAt: new Date("2026-06-14T10:00:00Z"),
          },
        ],
        nextCursor: null,
      }),
    });
    render(<LeadForm />, { wrapper: Wrapper });

    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    serverVersion = 7;
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: [["leadForm", "byPeriod"]],
      });
    });
    await waitFor(() => expect(sectionQuery).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Autosaved")).toBeInTheDocument();
    expect(queryClient.getMutationCache().getAll()).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Fill from most recent submitted period",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: /^Fill from Week \d+\?$/,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Replace & Fill" }),
    );

    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()).toHaveLength(1),
    );
    expect(queryClient.getMutationCache().getAll()[0]?.state.variables).toEqual(
      {
        targetSectionId: section().reportSectionId,
        sourceSectionId,
        version: 7,
      },
    );
  });
});
