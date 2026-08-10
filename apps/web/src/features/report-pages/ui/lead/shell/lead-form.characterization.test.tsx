import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../../../../shared/lib/query/cache-keys";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../../../shared/lib/query/cache-keys", async (importActual) => ({
  ...(await importActual<
    typeof import("../../../../../shared/lib/query/cache-keys")
  >()),
  invalidateLeadForm: vi.fn(),
  invalidateDashboard: vi.fn(),
  invalidateLeadHistory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

const SECTION_ID = "11111111-1111-1111-1111-111111111111";
const REPORT_ID = "33333333-3333-3333-3333-333333333333";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-4444-444444444444";
const STAGE_ID = "88888888-8888-4888-8888-888888888888";
const RISK_ID = "99999999-9999-4999-8999-999999999999";

function makeSection(overrides: { status?: "draft" | "submitted" } = {}) {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    version: 1,
    status: overrides.status ?? ("draft" as const),
    submittedAt: null,
    referencedProjects: [],
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        ownedStages: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 3 },
        ],
      },
    ],
    items: [
      {
        id: "55555555-5555-5555-5555-555555555555",
        stableId: "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a",
        projectId: PROJECT_ID,
        type: "current" as const,
        text: "Existing item",
        tag: "tag",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  };
}

function byPeriodPayload(section: unknown, readOnly = false) {
  return {
    section,
    readOnly,
    canRequestReopen: (section as { status?: string }).status === "submitted",
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
  };
}

function buildHarness(
  opts: {
    sectionStatus?: "draft" | "submitted";
    byPeriodQueryFn?: () => Promise<unknown>;
    myHistory?: readonly unknown[];
  } = {},
) {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
        authorRole: "lead" as const,
      },
    },
    { path: ["reports", "myHistory"], query: opts.myHistory ?? [] },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      query:
        opts.byPeriodQueryFn ??
        (() =>
          byPeriodPayload(
            makeSection(
              opts.sectionStatus === undefined
                ? {}
                : { status: opts.sectionStatus },
            ),
          )),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, captured, queryClient };
}

function clickEditableStageChip() {
  const chip = screen.getAllByRole("button").find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return (
      /^Development: (on-track|empty)/.test(label) &&
      button.getAttribute("aria-disabled") !== "true"
    );
  });
  if (!chip) throw new Error("no editable stage chip rendered");
  act(() => chip.click());
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("lead-form draft: save-echo + optimistic lock", () => {
  it("Save now flushes immediately, before the debounce elapses", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["reports.saveDraft"]).mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 2,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    clickEditableStageChip();
    const saveButtons = await screen.findAllByRole("button", {
      name: /Save draft now/i,
    });
    act(() => saveButtons[0]?.click());
    await waitFor(() =>
      expect(
        expectDefined(captured["reports.saveDraft"]).mutationFn,
      ).toHaveBeenCalledTimes(1),
    );
  });

  it("a stale-version submit surfaces the reload prompt, not the raw error", async () => {
    const { Wrapper, captured } = buildHarness();
    const conflict = new TRPCClientError("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });
    expectDefined(captured["reports.submit"]).mutationFn.mockRejectedValue(
      conflict,
    );
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => within(dialog).getByRole("button", { name: "Submit" }).click());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("changed elsewhere"),
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith("stale");
  });

  it("a clean external server edit reseeds the draft in place", async () => {
    let text = "Existing item";
    const { Wrapper, queryClient } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve(
          byPeriodPayload({
            ...makeSection(),
            version: 2,
            items: [{ ...makeSection().items[0], text }],
          }),
        ),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Existing item")).toBeInTheDocument();

    text = "Server rewrote this";
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    expect(await screen.findByText("Server rewrote this")).toBeInTheDocument();
  });

  it("a version-only bump reseeds the held version without dirtying, and the next submit carries it", async () => {
    let serverVersion = 1;
    const { Wrapper, captured, queryClient } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve(
          byPeriodPayload({ ...makeSection(), version: serverVersion }),
        ),
    });
    expectDefined(captured["reports.submit"]).mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 6,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    serverVersion = 5;
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    expect(screen.getByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => within(dialog).getByRole("button", { name: "Submit" }).click());
    await waitFor(() =>
      expect(
        expectDefined(captured["reports.submit"]).mutationFn.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    const sent = expectDefined(
      captured["reports.submit"],
    ).mutationFn.mock.calls.at(-1)?.[0] as { version?: number } | undefined;
    expect(sent?.version).toBe(5);
  });
});

describe("lead-form draft: quick-add + routeToBlocker", () => {
  it("quick-add current-week item opens the item dialog for the current week", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getAllByRole("button", { name: "+ Add" })[0]?.click());
    act(() =>
      screen.getByRole("button", { name: "Current week item" }).click(),
    );
    // The quick-add host opens the shared item editor, whose accessible name
    // ends in "dialog" (distinct from the "Confirm submission" dialog).
    expect(
      await screen.findByRole("dialog", { name: /dialog$/i }),
    ).toBeInTheDocument();
  });

  it("quick-add blocker routes to a blocked-severity risk prefill dialog", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getAllByRole("button", { name: "+ Add" })[0]?.click());
    act(() => screen.getByRole("button", { name: "Blocker" }).click());
    // routeToBlocker opens the risk editor prefilled as a blocker — a distinct
    // dialog from the quick-add item host.
    expect(
      await screen.findByRole("dialog", { name: /risk|blocker/i }),
    ).toBeInTheDocument();
  });
});

describe("lead-form draft: submit gating + dialogs", () => {
  it("a risk-stage coupling gap disables Submit and lists the blocker", async () => {
    const seeded = makeSection();
    const blocked = {
      ...seeded,
      projects: seeded.projects.map((project) => ({
        ...project,
        trafficLight: "red" as const,
      })),
      risks: [
        {
          id: RISK_ID,
          stableId: "9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a",
          projectId: PROJECT_ID,
          risk: "Release is blocked",
          impact: "The date will slip",
          mitigation: "Reduce scope",
          severity: "blocked" as const,
          stageNames: [],
        },
      ],
    };
    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () => Promise.resolve(byPeriodPayload(blocked)),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    expect(await screen.findByText("Blocks submission")).toBeInTheDocument();
    expect(
      screen.getByText("Test Product: specify stages for committed risks."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(
      screen.queryByRole("alertdialog", { name: "Confirm submission" }),
    ).toBeNull();
  });

  it("submit-confirm warns about unset own stages and coerces them to On Track", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["reports.submit"]).mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 2,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    expect(
      within(dialog).getByText(/1 stage not set.*marked On Track/i),
    ).toBeInTheDocument();

    act(() => within(dialog).getByRole("button", { name: "Submit" }).click());
    await waitFor(() =>
      expect(
        expectDefined(captured["reports.submit"]).mutationFn.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    const sent = expectDefined(
      captured["reports.submit"],
    ).mutationFn.mock.calls.at(-1)?.[0] as {
      stageStatuses?: { status: string | null }[];
    };
    expect(sent.stageStatuses?.map((stage) => stage.status)).toEqual(["green"]);
  });

  it("submit-confirm cancel closes the dialog without submitting", async () => {
    const { Wrapper, captured } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => within(dialog).getByRole("button", { name: "Cancel" }).click());
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", { name: "Confirm submission" }),
      ).toBeNull(),
    );
    expect(
      expectDefined(captured["reports.submit"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("submit success invalidates the lead caches and locks the form", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["reports.submit"]).mutationFn.mockResolvedValue({
      ...makeSection({ status: "submitted" }),
      version: 2,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => within(dialog).getByRole("button", { name: "Submit" }).click());

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Report submitted"),
    );
    expect(invalidateLeadForm).toHaveBeenCalled();
    expect(invalidateDashboard).toHaveBeenCalled();
    expect(invalidateLeadHistory).toHaveBeenCalled();
    expect(await screen.findByText("✓ Submitted")).toBeInTheDocument();
  });

  it("a submitted lead can open the Request Reopen dialog", async () => {
    const { Wrapper } = buildHarness({ sectionStatus: "submitted" });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    const reopen = await screen.findByRole("button", {
      name: /Request Reopen/i,
    });
    act(() => reopen.click());
    expect(
      await screen.findByRole("dialog", { name: /reopen/i }),
    ).toBeInTheDocument();
  });

  it("fill-from with unsaved edits prompts before overwriting and aborts on decline", async () => {
    const sourceSectionId = "99999999-9999-4999-8999-999999999990";
    const { Wrapper, captured } = buildHarness({
      myHistory: [
        {
          sectionId: SECTION_ID,
          reportId: REPORT_ID,
          periodStart: new Date("2026-06-15T00:00:00Z"),
          periodEnd: new Date("2026-06-21T00:00:00Z"),
          reportStatus: "open",
          sectionStatus: "draft",
          submittedAt: null,
          publishedAt: null,
        },
        {
          sectionId: sourceSectionId,
          reportId: "99999999-9999-4999-8999-999999999991",
          periodStart: new Date("2026-06-08T00:00:00Z"),
          periodEnd: new Date("2026-06-14T00:00:00Z"),
          reportStatus: "published",
          sectionStatus: "submitted",
          submittedAt: new Date("2026-06-13T10:00:00Z"),
          publishedAt: new Date("2026-06-14T10:00:00Z"),
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    clickEditableStageChip();

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    act(() =>
      within(documentActions)
        .getByRole("button", {
          name: "Fill from most recent submitted period",
        })
        .click(),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: /^Fill from Week \d+\?$/,
    });
    act(() =>
      within(dialog).getByRole("button", { name: "Replace & Fill" }).click(),
    );
    const overwriteDialog = await screen.findByRole("alertdialog", {
      name: "Overwrite unsaved changes?",
    });
    act(() =>
      within(overwriteDialog).getByRole("button", { name: "Cancel" }).click(),
    );
    expect(
      expectDefined(captured["leadForm.fillFrom"]).mutationFn,
    ).not.toHaveBeenCalled();
  });
});
