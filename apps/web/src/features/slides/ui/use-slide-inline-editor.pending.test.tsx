// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { mapLeadFormData } from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import { useLeadSlidesData } from "./use-lead-slides-data";
import { useSlideInlineEditor } from "./use-slide-inline-editor";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/lead/report/report-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../shared/hooks/query/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

function makeSection(sectionId = "section-1"): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: sectionId,
    reportId: "report-1",
    projects: [
      {
        projectId: "p1",
        projectName: "Portal",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: "s1",
            stageName: "Planning",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [{ stageId: "s1", stageName: "Planning", sortOrder: 0 }],
      },
    ],
    items: [
      {
        id: "i1",
        stableId: "item-1",
        projectId: "p1",
        text: "Original item",
        type: "current",
        workflowStatus: "in_progress",
        tag: "",
        carriedOver: false,
        stageNames: ["Planning"],
      },
    ],
    risks: [
      {
        id: "r1",
        stableId: "risk-1",
        projectId: "p1",
        risk: "Original risk",
        impact: "Delay",
        mitigation: "Fallback",
        severity: "at-risk",
        stageNames: ["Planning"],
      },
    ],
    decisions: [
      {
        id: "d1",
        stableId: "decision-1",
        productId: "p1",
        text: "Original decision",
        owner: "Test Lead",
        impact: "Ship safely",
        stageNames: ["Planning"],
      },
    ],
  });
}

function Harness({ section }: { readonly section: ReportSectionReadModel }) {
  const formData = mapLeadFormData({
    active: section,
    byPeriod: { section, readOnly: false },
    history: [],
  });
  const editor = useSlideInlineEditor({
    section,
    formData,
    canInlineEdit: true,
    refetchSection: () => Promise.resolve(undefined),
  });
  return (
    <>
      {(["item", "risk", "decision"] as const).map((kind) => (
        <button
          key={kind}
          onClick={() =>
            editor.onRowActivate?.({ kind, stableId: `${kind}-1` })
          }
        >
          Open {kind}
        </button>
      ))}
      {editor.dialogs}
    </>
  );
}

function setup() {
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "getActive"], query: null },
    { path: ["leadForm", "byPeriod"], query: null },
  ]);
  const save = captured["reports.saveDraft"];
  if (!save) throw new Error("Missing save fixture");
  const pending = Promise.withResolvers<unknown>();
  save.mutationFn.mockImplementationOnce(() => pending.promise);
  const client = makeQueryClient();
  const ui = (section: ReportSectionReadModel) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        <Harness section={section} />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  const rendered = render(ui(makeSection()));
  return {
    pending,
    save,
    rerenderSection: (section: ReportSectionReadModel) =>
      rendered.rerender(ui(section)),
  };
}

const cases = [
  {
    kind: "item",
    label: /Description/,
    saveLabel: "Save item",
    field: "items",
    textKey: "text",
  },
  {
    kind: "risk",
    label: /^Risk/,
    saveLabel: "Save risk",
    field: "risks",
    textKey: "risk",
  },
  {
    kind: "decision",
    label: /^Decision/,
    saveLabel: "Save decision",
    field: "decisions",
    textKey: "text",
  },
] as const;

describe("slide pending writes with real record dialogs", () => {
  it.each(cases)(
    "locks $kind fields, dismissal and activation, then retains a failed draft",
    async ({ kind, label, saveLabel, field, textKey }) => {
      const { pending, save } = setup();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: `Open ${kind}` }));
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, "Sent A");
      await user.click(screen.getByRole("button", { name: saveLabel }));
      await waitFor(() => expect(save.calls).toHaveLength(1));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-busy", "true");
      for (const role of ["textbox", "combobox", "button"] as const) {
        for (const control of within(dialog).queryAllByRole(role))
          expect(control).toBeDisabled();
      }
      await user.type(input, "Unsent B");
      expect(input).toHaveValue("Sent A");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(dialog, { key: "Enter", ctrlKey: true });
      if (dialog.parentElement) fireEvent.click(dialog.parentElement);
      await user.click(
        screen.getByRole("button", {
          name: kind === "risk" ? "Open decision" : "Open risk",
        }),
      );
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(save.calls).toHaveLength(1);
      expect(save.calls[0]).toMatchObject({
        [field]: [expect.objectContaining({ [textKey]: "Sent A" })],
      });
      await act(async () => {
        pending.reject(new Error("Save unavailable"));
        await pending.promise.catch(() => undefined);
      });
      await waitFor(() => expect(input).toBeEnabled());
      expect(input).toHaveValue("Sent A");
      await user.type(input, " revised");
      await user.click(screen.getByRole("button", { name: saveLabel }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(save.calls).toHaveLength(2);
      expect(save.calls[1]).toMatchObject({
        [field]: [expect.objectContaining({ [textKey]: "Sent A revised" })],
      });
    },
  );

  it("locks the actual delete confirmation and closes on success", async () => {
    const { pending, save } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open item" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirmation = screen.getByRole("alertdialog");
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(save.calls).toHaveLength(1));
    expect(
      within(confirmation).getByRole("button", { name: "Delete" }),
    ).toBeDisabled();
    expect(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBe(confirmation);
    await act(async () => {
      pending.resolve({ version: 2 });
      await pending.promise;
    });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(save.calls[0]).toMatchObject({ items: [] });
  });

  it("hides an editor on section switch even when the stable record ID matches", () => {
    const { rerenderSection } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open item" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerenderSection(makeSection("section-2"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open item" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

function ReloadHarness() {
  const data = useLeadSlidesData({
    initialReportId: "report-1",
    foreignContent: undefined,
    foreignContentPending: false,
    visibilityMode: "mine",
    visibilityHydrated: true,
  });
  const editor = useSlideInlineEditor(data);
  const ref: GridRowEditableRef = { kind: "item", stableId: "item-1" };
  return (
    <>
      <button onClick={() => editor.onRowActivate?.(ref)}>
        Open loaded item
      </button>
      <button onClick={() => void data.refetchSection()}>
        Refresh loaded section
      </button>
      <span data-testid="read-state">
        {data.isError ? "failed" : data.isLoading ? "loading" : "loaded"}
      </span>
      {editor.dialogs}
    </>
  );
}

describe("slide conflict through its real section query producer", () => {
  it.each([true, false])(
    "announces the actual reload outcome (fails=%s)",
    async (fails) => {
      toastError.mockClear();
      let reads = 0;
      const section = makeSection();
      const reload = Promise.withResolvers<unknown>();
      const { proxy, captured } = createMockTRPC([
        { path: ["reports", "saveDraft"], mutation: true },
        { path: ["reports", "getActive"], query: { reportId: "report-1" } },
        { path: ["reports", "myHistory"], query: { items: [] } },
        { path: ["leadForm", "crossAuthors"], query: [] },
        {
          path: ["leadForm", "byPeriod"],
          query: () =>
            ++reads === 1 ? { section, readOnly: false } : reload.promise,
        },
      ]);
      const error = new TRPCClientError<never>("stale");
      Object.defineProperty(error, "data", { value: { code: "CONFLICT" } });
      captured["reports.saveDraft"]?.mutationFn.mockRejectedValueOnce(error);
      const client = makeQueryClient();
      client.setDefaultOptions({
        ...client.getDefaultOptions(),
        queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
      });
      render(
        <QueryClientProvider client={client}>
          <TRPCProxyContext.Provider value={proxy}>
            <ReloadHarness />
          </TRPCProxyContext.Provider>
        </QueryClientProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("read-state")).toHaveTextContent("loaded"),
      );
      fireEvent.click(screen.getByRole("button", { name: "Open loaded item" }));
      fireEvent.click(screen.getByRole("button", { name: "Save item" }));
      await waitFor(() => expect(reads).toBe(2));
      expect(toastError).not.toHaveBeenCalled();
      await act(async () => {
        if (fails) reload.reject(new Error("Read unavailable"));
        else
          reload.resolve({
            section: { ...section, version: 2 },
            readOnly: false,
          });
        await reload.promise.catch(() => undefined);
      });
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          expect.stringContaining(
            fails ? "Reload failed" : "Reloaded the latest version",
          ),
        ),
      );
      expect(toastError).not.toHaveBeenCalledWith(
        expect.stringContaining(
          fails ? "Reloaded the latest version" : "Reload failed",
        ),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );
});

describe("slide editor same-record placement refresh", () => {
  it("updates week choices without discarding dirty input and preserves a failed pending save", async () => {
    let section = { ...makeSection(), risks: [], decisions: [] };
    const pending = Promise.withResolvers<unknown>();
    const { proxy, captured } = createMockTRPC([
      { path: ["reports", "saveDraft"], mutation: true },
      { path: ["reports", "getActive"], query: { reportId: "report-1" } },
      { path: ["reports", "myHistory"], query: { items: [] } },
      { path: ["leadForm", "crossAuthors"], query: [] },
      {
        path: ["leadForm", "byPeriod"],
        query: () => ({ section, readOnly: false }),
      },
    ]);
    const save = captured["reports.saveDraft"];
    if (!save) throw new Error("Missing save fixture");
    save.mutationFn.mockImplementationOnce(() => pending.promise);
    const client = makeQueryClient();
    render(
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          <ReloadHarness />
        </TRPCProxyContext.Provider>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId("read-state")).toHaveTextContent("loaded"),
    );
    await user.click(screen.getByRole("button", { name: "Open loaded item" }));
    const input = screen.getByLabelText(/Description/);
    await user.clear(input);
    await user.type(input, "Unsaved author text");
    expect(
      screen.getByRole("button", { name: "Not started" }),
    ).toBeInTheDocument();
    section = {
      ...section,
      version: 2,
      items: section.items.map((item) => ({ ...item, type: "next" as const })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh loaded section" }),
    );
    await screen.findByRole("button", { name: "Planned" });
    expect(
      screen.queryByRole("button", { name: "Not started" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Unsaved author text",
    );
    await user.click(screen.getByRole("button", { name: "Save item" }));
    await waitFor(() => expect(save.calls).toHaveLength(1));
    expect(save.calls[0]).toMatchObject({
      version: 2,
      items: [
        expect.objectContaining({
          stableId: "item-1",
          type: "next",
          text: "Unsaved author text",
        }),
      ],
    });
    expect(screen.getByLabelText(/Description/)).toBeDisabled();
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Unsaved author text",
    );
    await act(async () => {
      pending.reject(new Error("Save unavailable"));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/Description/)).toBeEnabled(),
    );
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Unsaved author text",
    );
    expect(screen.getByRole("button", { name: "Planned" })).toBeInTheDocument();
  });
});
