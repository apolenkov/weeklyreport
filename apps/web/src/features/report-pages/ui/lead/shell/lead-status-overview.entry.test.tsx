import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  pollUntil,
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

describe("Overview entry lines", () => {
  it("opens quick-create with the selected product and saves through the live draft", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000020";
    const serverStableId = "a0000000-0000-4000-8000-000000000021";
    const savedResponses: ReportSectionReadModel[] = [];
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        const savedResponse = {
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        };
        savedResponses.push(savedResponse);
        return Promise.resolve(savedResponse);
      },
    );
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

    expect(
      screen.getByRole("form", { name: "Add item for Payments, current week" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      "All changes saved",
    );
    const description = screen.getByRole("textbox", {
      name: /What happened…|Plan…/,
    });
    // Deliberately duplicate the existing row's complete authored fields. A
    // text/content lookup cannot distinguish the acknowledgement; only the
    // server stableId introduced for this attempt can.
    await user.type(description, "Current work");
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      "1 unsaved change",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    const submittedItems = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items;
    const submittedItemsWithoutStableIdentity = submittedItems.filter(
      (item) => item.stableId === undefined,
    );
    expect(submittedItemsWithoutStableIdentity).toHaveLength(1);
    expect(submittedItemsWithoutStableIdentity[0]?.id).not.toBe(serverItemId);
    expect(
      savedResponses[0]?.items.filter(
        (item) => item.stableId === serverStableId,
      ),
    ).toEqual([
      expect.objectContaining({ id: serverItemId, stableId: serverStableId }),
    ]);
    expect(
      screen.getAllByRole("button", {
        name: /^(Edit|View) text: Current work, This week$/,
      }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("region", { name: "Unsaved update recovery" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("overview-save-state")).toHaveTextContent(
      /Saving…|All changes saved/,
    );
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveFocus());
  });

  it("Quick Save clears the composer fields and returns focus to the description", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000040";
    const serverStableId = "a0000000-0000-4000-8000-000000000041";
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        });
      },
    );
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
    await user.type(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
      "First batch item",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await vi.waitFor(
      () =>
        expect(
          screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
        ).toHaveValue(""),
      { timeout: 2000 },
    );
    expect(
      screen.getByRole("form", { name: "Add item for Payments, current week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
    ).toHaveFocus();
  });

  it("Quick Save keeps creating in the week the lead chose", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? {
                  ...item,
                  id: "a0000000-0000-4000-8000-000000000050",
                  stableId: "a0000000-0000-4000-8000-000000000051",
                }
              : item,
          ),
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Plan something — Payments, Next week",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
      "First next item",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await vi.waitFor(
      () =>
        expect(
          screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
        ).toHaveValue(""),
      { timeout: 2000 },
    );
    expect(
      screen.getByRole("form", { name: "Add item for Payments, next week" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Plan…")).toBeInTheDocument();
  });

  it("Quick Save validation failure retains input and keeps editor open", async () => {
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
    // Non-empty input that fails client validation: one character over the
    // 500-character description limit. The composer must keep it verbatim.
    const overLimit = "a".repeat(501);
    await user.click(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
    );
    await user.paste(overLimit);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveDraft).not.toHaveBeenCalled();
    expect(
      screen.getByRole("form", { name: "Add item for Payments, current week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Description must be 500 characters or fewer."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
    ).toHaveValue(overLimit);
  });

  it("Quick Save persistence failure retains input and keeps editor open", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() =>
      Promise.reject(new Error("network unavailable")),
    );
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
    const description = screen.getByRole("textbox", {
      name: /What happened…|Plan…/,
    });
    await user.type(description, "Persistent failure item");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Add item for Payments, current week" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
    ).toHaveValue("Persistent failure item");
  });

  it("creates a Next item from the Next week Add item with Planned progress and keeps the entry focused", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000030";
    const serverStableId = "a0000000-0000-4000-8000-000000000031";
    const savedResponses: ReportSectionReadModel[] = [];
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        const savedResponse = {
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        };
        savedResponses.push(savedResponse);
        return Promise.resolve(savedResponse);
      },
    );
    render(
      <Wrapper saveDraft={saveDraft}>
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
    expect(screen.getAllByRole("form")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("report-unit-footer")).not.toBeInTheDocument();
    expect(within(form).getByPlaceholderText("Plan…")).toBeInTheDocument();
    // Cells never offer creation: the unit header is the only entry point.
    expect(
      document.querySelectorAll("[data-overview-create-origin]"),
    ).toHaveLength(0);

    await user.type(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
      "Next path",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveValue(""));

    const submitted = (
      saveDraft.mock.calls[0]?.[0] as {
        readonly items: ReportSectionReadModel["items"];
      }
    ).items;
    const created = submitted.filter((item) => item.stableId === undefined);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      type: "next",
      text: "Next path",
      workflowStatus: "planned",
      carriedOver: false,
    });
    expect(submitted.filter((item) => item.type === "next")).toHaveLength(2);
    // Direct Next creation never rewrites the saved Current progress.
    expect(submitted.find((item) => item.type === "current")).toMatchObject({
      text: "Current work",
      workflowStatus: "in_progress",
    });
    expect(savedResponses).toHaveLength(1);

    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveFocus());
  });

  it("keeps the entry focused in a unit with several Current rows and keeps it inside that unit", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000050";
    const serverStableId = "a0000000-0000-4000-8000-000000000051";
    const saveDraft = vi.fn(
      (input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        });
      },
    );
    render(
      <Wrapper saveDraft={saveDraft} extraCurrentRow>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add what happened — Payments, This week",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
      "Fresh current item",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(saveDraft).toHaveBeenCalledOnce());
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveFocus());
    const unit = screen.getByRole("article", { name: "Product Payments" });
    expect(unit).toContainElement(document.activeElement as HTMLElement);
  });

  it("keeps the entry focused after a retried create save that failed once", async () => {
    const user = userEvent.setup();
    const serverItemId = "a0000000-0000-4000-8000-000000000060";
    const serverStableId = "a0000000-0000-4000-8000-000000000061";
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.reject(new Error("network unavailable")),
      )
      .mockImplementation((input: unknown, current: ReportSectionReadModel) => {
        const draft = input as {
          readonly version: number;
          readonly items: ReportSectionReadModel["items"];
        };
        return Promise.resolve({
          ...current,
          version: draft.version + 1,
          items: draft.items.map((item) =>
            item.stableId === undefined
              ? { ...item, id: serverItemId, stableId: serverStableId }
              : item,
          ),
        });
      });
    render(
      <Wrapper saveDraft={saveDraft} extraCurrentRow>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add what happened — Payments, This week",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /What happened…|Plan…/ }),
      "Retried current item",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Save failed. Your update is still here; try saving again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Add item for Payments, current week" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    await pollUntil(() => expect(screen.getByRole("textbox")).toHaveFocus());
  });
});
