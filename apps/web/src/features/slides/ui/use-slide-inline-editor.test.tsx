// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeQueryClient } from "../../../lib/query-client";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import {
  makeReportSectionFixture,
  type ReportSectionFixture,
} from "../../../test-utils/report-section-fixtures";
import type { KanbanItem } from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import type { LeadSlideFormData } from "./lead-slide-form-data";
import { useSlideInlineEditor } from "./use-slide-inline-editor";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => {
      toastError(...args);
    },
    success: vi.fn(),
  },
}));

vi.mock("../../report-sections/ui/item-edit-dialog", () => ({
  ItemEditDialog: ({
    open,
    item,
    onSave,
    onDelete,
  }: {
    open: boolean;
    item: KanbanItem | null;
    onSave: (item: KanbanItem) => void;
    onDelete?: () => void;
  }) =>
    open && item ? (
      <div data-testid="item-dialog">
        <span>{item.text}</span>
        <button
          type="button"
          data-testid="save-item"
          onClick={() => onSave({ ...item, text: "Edited item" })}
        >
          save
        </button>
        <button type="button" data-testid="delete-item" onClick={onDelete}>
          delete
        </button>
      </div>
    ) : null,
}));

vi.mock("../../review/ui/risk-edit-dialog", () => ({
  RiskEditDialog: ({
    open,
    risk,
    onSave,
  }: {
    open: boolean;
    risk: { text: string } | null;
    onSave: (risk: unknown) => void;
  }) =>
    open && risk ? (
      <div data-testid="risk-dialog">
        <span>{risk.text}</span>
        <button
          type="button"
          data-testid="save-risk"
          onClick={() => onSave({ ...risk, text: "Edited risk" })}
        >
          save
        </button>
      </div>
    ) : null,
}));

vi.mock("../../period/ui/decision-edit-dialog", () => ({
  DecisionEditDialog: ({
    open,
    decision,
    onSave,
  }: {
    open: boolean;
    decision: { text: string } | null;
    onSave: (decision: unknown) => void;
  }) =>
    open && decision ? (
      <div data-testid="decision-dialog">
        <span>{decision.text}</span>
        <button
          type="button"
          data-testid="save-decision"
          onClick={() => onSave({ ...decision, text: "Edited decision" })}
        >
          save
        </button>
      </div>
    ) : null,
}));

vi.mock("../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    title,
    preview,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    preview: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <button type="button" data-testid="confirm-delete" onClick={onConfirm}>
        {title}: {preview}
      </button>
    ) : null,
}));

const SECTION_ID = "sec-1";
const REPORT_ID = "rep-1";
const AUTHOR_ID = "lead-1";
const PRODUCT_ID = "p1";
const ITEM_ID = "item-1";
const ITEM_STABLE_ID = "item-stable-1";
const RISK_ID = "risk-1";
const RISK_STABLE_ID = "risk-stable-1";
const DECISION_ID = "decision-1";
const DECISION_STABLE_ID = "decision-stable-1";

const ITEM_REF: GridRowEditableRef = { kind: "item", stableId: ITEM_STABLE_ID };
const RISK_REF: GridRowEditableRef = { kind: "risk", stableId: RISK_STABLE_ID };
const DECISION_REF: GridRowEditableRef = {
  kind: "decision",
  stableId: DECISION_STABLE_ID,
};

function makeSection(over: ReportSectionFixture = {}): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [
      { projectId: PRODUCT_ID, projectName: "Alpha", trafficLight: null },
    ],
    items: [
      {
        id: ITEM_ID,
        stableId: ITEM_STABLE_ID,
        projectId: PRODUCT_ID,
        activityId: null,
        type: "current",
        text: "Existing item",
        tag: "",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: [],
      },
    ],
    risks: [
      {
        id: RISK_ID,
        stableId: RISK_STABLE_ID,
        projectId: PRODUCT_ID,
        activityId: null,
        risk: "Existing risk",
        impact: "Impact",
        mitigation: "Mitigation",
        severity: "at-risk",
        stageNames: [],
      },
    ],
    decisions: [
      {
        id: DECISION_ID,
        stableId: DECISION_STABLE_ID,
        productId: PRODUCT_ID,
        activityId: null,
        text: "Existing decision",
        owner: "Test Lead",
        impact: "Impact",
        stageNames: [],
      },
    ],
    activities: [],
    ...over,
  });
}

function makeFormData(): LeadSlideFormData {
  return {
    products: [
      { id: PRODUCT_ID, name: "Alpha", overallStatus: "on-track", stages: [] },
    ],
    currentWeekItems: [
      {
        id: ITEM_ID,
        parent: { kind: "product", id: PRODUCT_ID },
        productId: PRODUCT_ID,
        productName: "Alpha",
        activityId: null,
        status: "in-progress",
        text: "Existing item",
        author: "Test Lead",
        priorityRank: null,
        pausedReason: null,
        stageNames: [],
      },
    ],
    nextWeekItems: [],
    risks: [
      {
        id: RISK_ID,
        productId: PRODUCT_ID,
        productName: "Alpha",
        activityId: null,
        severity: "at-risk",
        text: "Existing risk",
        impact: "Impact",
        mitigation: "Mitigation",
        stageNames: [],
      },
    ],
    decisions: [
      {
        id: DECISION_ID,
        productId: PRODUCT_ID,
        productName: "Alpha",
        activityId: null,
        text: "Existing decision",
        owner: "Test Lead",
        impact: "Impact",
        deadline: null,
        stageNames: [],
      },
    ],
    priorities: [],
    activityCards: [],
    periods: [],
    currentUser: {
      name: "Test Lead",
      initials: "TL",
      role: "Dev Lead",
      authorRole: "lead",
    },
    readOnly: false,
    canRequestReopen: false,
  };
}

function Harness({
  section,
  formData,
  canInlineEdit,
  refetchSection,
  activateRef,
}: {
  readonly section: ReportSectionReadModel | null;
  readonly formData: LeadSlideFormData | null;
  readonly canInlineEdit: boolean;
  readonly refetchSection: () => Promise<unknown>;
  readonly activateRef: GridRowEditableRef;
}) {
  const editor = useSlideInlineEditor({
    section,
    formData,
    canInlineEdit,
    refetchSection,
  });
  return (
    <div>
      <div data-testid="editable">
        {String(editor.onRowActivate !== undefined)}
      </div>
      <button
        type="button"
        data-testid="activate"
        onClick={() => editor.onRowActivate?.(activateRef)}
      >
        activate
      </button>
      {editor.dialogs}
    </div>
  );
}

function renderHarness({
  section = makeSection(),
  formData = makeFormData(),
  canInlineEdit = true,
  activateRef = ITEM_REF,
}: {
  readonly section?: ReportSectionReadModel | null;
  readonly formData?: LeadSlideFormData | null;
  readonly canInlineEdit?: boolean;
  readonly activateRef?: GridRowEditableRef;
} = {}) {
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "getActive"], query: { reportId: REPORT_ID } },
    { path: ["leadForm", "byPeriod"], query: { section } },
    { path: ["reports", "saveDraft"], mutation: true },
  ]);
  const queryClient = makeQueryClient();
  const refetchSection = vi.fn().mockResolvedValue(undefined);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(
    <Wrapper>
      <Harness
        section={section}
        formData={formData}
        canInlineEdit={canInlineEdit}
        refetchSection={refetchSection}
        activateRef={activateRef}
      />
    </Wrapper>,
  );
  return { captured, refetchSection };
}

describe("useSlideInlineEditor — activation gating", () => {
  it("exposes no activation handler when inline edit is disabled", () => {
    renderHarness({ canInlineEdit: false });
    expect(screen.getByTestId("editable")).toHaveTextContent("false");
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.queryByTestId("item-dialog")).not.toBeInTheDocument();
  });

  it("opens the matching dialog only for a ref that resolves against the section", () => {
    renderHarness({
      activateRef: { kind: "item", stableId: "does-not-exist" },
    });
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.queryByTestId("item-dialog")).not.toBeInTheDocument();
  });
});

describe("useSlideInlineEditor — save payloads", () => {
  it("saves an edited item through reports.saveDraft and clears the editor on success", async () => {
    const { captured, refetchSection } = renderHarness();
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.getByTestId("item-dialog")).toHaveTextContent(
      "Existing item",
    );

    fireEvent.click(screen.getByTestId("save-item"));

    const saveDraft = captured["reports.saveDraft"];
    await waitFor(() => expect(saveDraft?.calls).toHaveLength(1));
    expect(saveDraft?.calls[0]).toEqual(
      expect.objectContaining({
        reportSectionId: SECTION_ID,
        version: 1,
        items: [
          expect.objectContaining({
            stableId: ITEM_STABLE_ID,
            text: "Edited item",
          }),
        ],
      }),
    );
    // Success clears the editor state — the dialog closes and the section refetches.
    await waitFor(() =>
      expect(screen.queryByTestId("item-dialog")).not.toBeInTheDocument(),
    );
    expect(refetchSection).toHaveBeenCalled();
  });

  it("saves an edited risk through reports.saveDraft", async () => {
    const { captured } = renderHarness({ activateRef: RISK_REF });
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.getByTestId("risk-dialog")).toHaveTextContent(
      "Existing risk",
    );

    fireEvent.click(screen.getByTestId("save-risk"));

    const saveDraft = captured["reports.saveDraft"];
    await waitFor(() => expect(saveDraft?.calls).toHaveLength(1));
    expect(saveDraft?.calls[0]).toEqual(
      expect.objectContaining({
        risks: [
          expect.objectContaining({
            stableId: RISK_STABLE_ID,
            risk: "Edited risk",
          }),
        ],
      }),
    );
  });

  it("saves an edited decision through reports.saveDraft", async () => {
    const { captured } = renderHarness({ activateRef: DECISION_REF });
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.getByTestId("decision-dialog")).toHaveTextContent(
      "Existing decision",
    );

    fireEvent.click(screen.getByTestId("save-decision"));

    const saveDraft = captured["reports.saveDraft"];
    await waitFor(() => expect(saveDraft?.calls).toHaveLength(1));
    expect(saveDraft?.calls[0]).toEqual(
      expect.objectContaining({
        decisions: [
          expect.objectContaining({
            stableId: DECISION_STABLE_ID,
            text: "Edited decision",
          }),
        ],
      }),
    );
  });

  it("deletes the active record through the confirm dialog", async () => {
    const { captured } = renderHarness();
    fireEvent.click(screen.getByTestId("activate"));
    fireEvent.click(screen.getByTestId("delete-item"));
    expect(screen.getByTestId("confirm-delete")).toHaveTextContent(
      "Delete item?: Existing item",
    );

    fireEvent.click(screen.getByTestId("confirm-delete"));

    const saveDraft = captured["reports.saveDraft"];
    await waitFor(() => expect(saveDraft?.calls).toHaveLength(1));
    expect(saveDraft?.calls[0]).toEqual(expect.objectContaining({ items: [] }));
  });

  it("unmounts the edit dialog when the delete confirmation opens", () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("activate"));
    expect(screen.getByTestId("item-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("delete-item"));

    expect(screen.queryByTestId("item-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("confirm-delete")).toBeInTheDocument();
  });
});

describe("useSlideInlineEditor — conflict path", () => {
  it("keeps the dialog open, reloads the section, and reports the conflict on a version mismatch", async () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["reports", "getActive"], query: { reportId: REPORT_ID } },
      { path: ["leadForm", "byPeriod"], query: { section: makeSection() } },
      { path: ["reports", "saveDraft"], mutation: true },
    ]);
    const saveDraft = captured["reports.saveDraft"];
    const conflictError = new TRPCClientError<never>("stale");
    Object.defineProperty(conflictError, "data", {
      value: { code: "CONFLICT" },
      configurable: true,
    });
    saveDraft?.mutationFn.mockRejectedValueOnce(conflictError);
    const queryClient = makeQueryClient();
    const refetchSection = vi.fn().mockResolvedValue(undefined);

    render(
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <Harness
            section={makeSection()}
            formData={makeFormData()}
            canInlineEdit
            refetchSection={refetchSection}
            activateRef={ITEM_REF}
          />
        </TRPCProxyContext.Provider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("activate"));
    fireEvent.click(screen.getByTestId("save-item"));

    await waitFor(() => expect(saveDraft?.calls).toHaveLength(1));
    await waitFor(() => expect(refetchSection).toHaveBeenCalled());
    // The reload announcement waits for the refetch to settle: the toast is
    // only emitted once the refetch promise has resolved.
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Reloaded the latest version"),
      ),
    );
    // A conflict reloads the section instead of silently closing the editor —
    // the caller re-applies the edit against the fresh data.
    expect(screen.getByTestId("item-dialog")).toBeInTheDocument();
  });
});
