/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SessionContext,
  type SessionState,
} from "../../../lib/session-provider";
import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { KanbanItem } from "../../report-sections";
import { LeadSlidesClient } from "./lead-slides-client";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_AUTHOR_ID = "55555555-5555-4555-8555-555555555555";
const ITEM_ID = "66666666-6666-4666-8666-666666666666";
const ITEM_STABLE_ID = "77777777-7777-4777-8777-777777777777";
const STAGE_ID = "88888888-8888-4888-8888-888888888888";

let mockPathname = `/lead/report/${REPORT_ID}`;
let mockSearchParams = new URLSearchParams();
let mockActivationRef: { kind: "item"; stableId: string } = {
  kind: "item",
  stableId: ITEM_STABLE_ID,
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../lib/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

vi.mock("./report-slides", () => ({
  ReportSlides: ({
    onRowActivate,
  }: {
    onRowActivate?: (ref: { kind: "item"; stableId: string }) => void;
  }) => (
    <div
      data-testid="report-slides"
      data-editable={String(onRowActivate !== undefined)}
    >
      <button
        type="button"
        data-testid="activate-row"
        onClick={() => onRowActivate?.(mockActivationRef)}
      >
        activate row
      </button>
    </div>
  ),
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
          onClick={() => onSave({ ...item, text: "Edited from slide" })}
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
  RiskEditDialog: () => null,
}));

vi.mock("../../period/ui/decision-edit-dialog", () => ({
  DecisionEditDialog: () => null,
}));

vi.mock("../../../shared/ui/confirm-delete-dialog", () => ({
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

const session: SessionState = {
  user: {
    id: AUTHOR_ID,
    name: "Test Lead",
    email: "lead@example.com",
    role: "lead",
  },
  organization: null,
  isLoading: false,
  isAuthenticated: true,
};

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 3,
            status: "green",
          },
        ],
      },
    ],
    items: [
      {
        id: ITEM_ID,
        stableId: ITEM_STABLE_ID,
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Existing item",
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
    activities: [],
    ...overrides,
  };
}

function makeHistoryEntry(section: ReportSectionReadModel): MyHistoryEntry {
  return {
    sectionId: section.reportSectionId,
    reportId: section.reportId,
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T00:00:00.000Z"),
    reportStatus: "draft",
    sectionStatus: section.status,
    archived: false,
    submittedAt: section.submittedAt,
    publishedAt: null,
    itemCount: section.items.length,
    riskCount: section.risks.length,
    decisionCount: section.decisions.length,
    priorityCount: 0,
    productCount: section.projects.length,
  };
}

function renderHarness({
  section = makeSection(),
  readOnly = false,
  search = "",
}: {
  readonly section?: ReportSectionReadModel;
  readonly readOnly?: boolean;
  readonly search?: string;
} = {}) {
  mockSearchParams = new URLSearchParams(search);
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "getActive"], query: { reportId: REPORT_ID } },
    {
      path: ["reports", "myHistory"],
      query: () => [makeHistoryEntry(section)],
    },
    { path: ["reports", "saveDraft"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: () => ({
        section,
        readOnly,
        canRequestReopen: false,
      }),
    },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <SessionContext.Provider value={session}>
            {children}
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(
    <Wrapper>
      <LeadSlidesClient initialReportId={REPORT_ID} />
    </Wrapper>,
  );
  return { captured, queryClient };
}

beforeEach(() => {
  mockPathname = `/lead/report/${REPORT_ID}`;
  mockSearchParams = new URLSearchParams();
  mockActivationRef = { kind: "item", stableId: ITEM_STABLE_ID };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LeadSlidesClient inline slide editing", () => {
  it("opens an own item row and saves through reports.saveDraft", async () => {
    const { captured } = renderHarness();
    await screen.findByTestId("report-slides");

    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-editable",
      "true",
    );
    fireEvent.click(screen.getByTestId("activate-row"));
    expect(screen.getByTestId("item-dialog")).toHaveTextContent(
      "Existing item",
    );

    fireEvent.click(screen.getByTestId("save-item"));

    await waitFor(() =>
      expect(captured["reports.saveDraft"].calls).toHaveLength(1),
    );
    expect(captured["reports.saveDraft"].calls[0]).toEqual(
      expect.objectContaining({
        reportSectionId: SECTION_ID,
        version: 1,
        items: [
          expect.objectContaining({
            id: ITEM_ID,
            stableId: ITEM_STABLE_ID,
            projectId: PROJECT_ID,
            activityId: null,
            text: "Edited from slide",
          }),
        ],
      }),
    );
  });

  it("deletes an open item through confirmation and the draft save payload", async () => {
    const { captured } = renderHarness();
    await screen.findByTestId("report-slides");

    fireEvent.click(screen.getByTestId("activate-row"));
    fireEvent.click(screen.getByTestId("delete-item"));
    expect(screen.getByTestId("confirm-delete")).toHaveTextContent(
      "Delete item?: Existing item",
    );

    fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() =>
      expect(captured["reports.saveDraft"].calls).toHaveLength(1),
    );
    expect(captured["reports.saveDraft"].calls[0]).toEqual(
      expect.objectContaining({
        reportSectionId: SECTION_ID,
        version: 1,
        items: [],
      }),
    );
  });

  it("does not bind row activation for a foreign author deck", async () => {
    renderHarness({ search: `authorId=${OTHER_AUTHOR_ID}` });
    await screen.findByTestId("report-slides");

    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-editable",
      "false",
    );
    fireEvent.click(screen.getByTestId("activate-row"));
    expect(screen.queryByTestId("item-dialog")).not.toBeInTheDocument();
  });

  it("does not bind row activation when byPeriod marks the section read-only", async () => {
    renderHarness({ readOnly: true });
    await screen.findByTestId("report-slides");

    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-editable",
      "false",
    );
  });

  it("does not bind row activation for a submitted section", async () => {
    renderHarness({ section: makeSection({ status: "submitted" }) });
    await screen.findByTestId("report-slides");

    expect(screen.getByTestId("report-slides")).toHaveAttribute(
      "data-editable",
      "false",
    );
  });
});
