import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mutable so a test can drive the addressed-route path (`/lead/report/<id>`),
// which makes LeadSlidesClient resolve inReportMode=true. Vitest allows
// `mock`-prefixed outer vars inside a hoisted vi.mock factory.
let mockPathname = "/lead/report";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname,
}));

const SECTION_ID = "11111111-1111-1111-1111-111111111111";
const REPORT_ID = "33333333-3333-3333-3333-333333333333";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-4444-444444444444";

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
        // Owned stage so the SDLC pipeline renders an editable chip for dirty tests.
        ownedStages: [
          {
            stageId: "88888888-8888-4888-8888-888888888888",
            stageName: "Development",
            sortOrder: 3,
          },
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
    decisions: [
      {
        id: "66666666-6666-6666-6666-666666666666",
        stableId: "6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a",
        text: "Existing decision",
        owner: "Owner",
        impact: "Impact",
      },
    ],
    priorities: [
      {
        id: "77777777-7777-7777-7777-777777777777",
        rank: 1,
        text: "Priority text",
      },
    ],
    activities: [],
  };
}

function buildHarness(
  opts: {
    sectionStatus?: "draft" | "submitted";
    byPeriodReadOnly?: boolean;
    canRequestReopen?: boolean;
    byPeriodQueryFn?: () => Promise<unknown>;
    myHistory?: readonly unknown[];
    unifiedActivityView?: boolean;
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
    {
      path: ["reports", "myHistory"],
      query: opts.myHistory ?? [],
    },
    {
      path: ["reports", "saveDraft"],
      mutation: true,
    },
    {
      path: ["reports", "submit"],
      mutation: true,
    },
    {
      path: ["leadForm", "byPeriod"],
      query:
        opts.byPeriodQueryFn ??
        (() => ({
          section: makeSection(
            opts.sectionStatus === undefined
              ? {}
              : { status: opts.sectionStatus },
          ),
          readOnly: opts.byPeriodReadOnly ?? false,
          // Server-computed; default true so Request-Reopen tests have a precondition.
          canRequestReopen:
            opts.canRequestReopen ?? opts.sectionStatus === "submitted",
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        })),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: opts.unifiedActivityView ?? false },
    },
    {
      path: ["leadForm", "revoke"],
      mutation: true,
    },
    {
      path: ["leadForm", "fillFrom"],
      mutation: true,
    },
    {
      path: ["leadForm", "requestReopen"],
      mutation: true,
    },
    {
      path: ["leadForm", "crossAuthors"],
      query: [],
    },
    {
      path: ["leadForm", "crossAuthorContent"],
      query: [],
    },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mockPathname = "/lead/report";
});

describe("LeadForm mutation wiring", () => {
  it("submit success: invalidates caches, fires toast.success", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
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

    // The submit flow lives in the draft module: toolbar Submit → confirm
    // dialog → confirm drives the mutation via mutateAsync; on success the
    // dialog module fires the toast and the seam invalidates the lead caches.
    act(() => screen.getByRole("button", { name: "Submit" }).click());
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => within(dialog).getByRole("button", { name: "Submit" }).click());

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Report submitted"),
    );
    // invalidateLeadForm + invalidateDashboard + invalidateLeadHistory.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("submit error: fires toast.error with the error message", async () => {
    const { Wrapper, captured } = buildHarness();
    expectDefined(captured["reports.submit"]).mutationFn.mockRejectedValue(
      new Error("Submit blew up"),
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
      expect(toast.error).toHaveBeenCalledWith("Submit blew up"),
    );
  });

  it("submit CONFLICT (stale version): surfaces the reload prompt, not the generic error", async () => {
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

    // A cross-writer conflict surfaces a distinct reload prompt rather than
    // echoing the raw error message.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("changed elsewhere"),
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith("stale");
  });

  it("submit after an autosave version bump carries the bumped version, not a stale closure", async () => {
    const { Wrapper, captured } = buildHarness();
    // The success path reads `.version`; resolve a versioned read model so it
    // does not throw. The assertion targets the submit INPUT, not this value.
    const submitEntry = expectDefined(captured["reports.submit"]);
    submitEntry.mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 6,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    const saveDraftEntry = expectDefined(captured["reports.saveDraft"]);
    await waitFor(() => expect(saveDraftEntry.lastOptions).toBeDefined());

    // An autosave succeeds and the server bumps the row to version 5. This
    // drives the component's version forward through the hook's onVersionChange
    // exactly as a live save would.
    const saveDraftOpts = saveDraftEntry.lastOptions as {
      onSuccess?: (saved: unknown) => void;
    };
    act(() => {
      saveDraftOpts.onSuccess?.({ version: 5 });
    });

    // Drive a real submit: toolbar Submit → confirm dialog → confirm.
    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });

    // Submit reads the CURRENT version (5) synchronously, not the
    // initially-loaded 1 captured in a stale closure.
    await waitFor(() =>
      expect(submitEntry.mutationFn.mock.calls.length).toBeGreaterThan(0),
    );
    const sent = submitEntry.mutationFn.mock.calls.at(-1)?.[0] as {
      version?: number;
    };
    expect(sent.version).toBe(5);
  });

  it("D4: submit-confirm warns about unset own stages and coerces them to On Track", async () => {
    // The seed's single owned stage carries no status → unset. The confirm
    // dialog warns, and confirming promotes it to green (mirrors the null→green
    // project/activity coercion).
    const { Wrapper, captured } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    expect(
      within(dialog).getByText(/1 stage not set.*marked On Track/i),
    ).toBeInTheDocument();

    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });
    const submitEntry = expectDefined(captured["reports.submit"]);
    await waitFor(() =>
      expect(submitEntry.mutationFn.mock.calls.length).toBeGreaterThan(0),
    );
    const sent = submitEntry.mutationFn.mock.calls.at(-1)?.[0] as {
      stageStatuses?: { status: string | null }[];
    };
    expect(sent.stageStatuses?.map((stage) => stage.status)).toEqual(["green"]);
  });

  it("D4: no unset own stages → the submit-confirm shows no warning", async () => {
    const seeded = makeSection();
    const withStatus = {
      ...seeded,
      projects: seeded.projects.map((p) => ({
        ...p,
        ownedStages: p.ownedStages.map((s) => ({
          ...s,
          status: "green" as const,
        })),
      })),
    };
    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: withStatus,
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    expect(
      within(dialog).queryByText(/not set.*marked On Track/i),
    ).not.toBeInTheDocument();
  });

  it("D4: explicit red and yellow own stages survive submit without an unset warning", async () => {
    const seeded = makeSection();
    const withOrphan = {
      ...seeded,
      risks: [],
      projects: seeded.projects.map((p) => ({
        ...p,
        ownedStages: [
          ...p.ownedStages.map((stage) => ({
            ...stage,
            status: "red" as const,
          })),
          {
            stageId: "77777777-7777-4777-8777-777777777777",
            stageName: "Testing",
            sortOrder: 4,
            status: "yellow" as const,
          },
        ],
      })),
    };
    const { Wrapper, captured } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: withOrphan,
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    expect(
      within(dialog).queryByText(/not set.*marked On Track/i),
    ).not.toBeInTheDocument();

    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });
    const submitEntry = expectDefined(captured["reports.submit"]);
    await waitFor(() =>
      expect(submitEntry.mutationFn.mock.calls.length).toBeGreaterThan(0),
    );
    const sent = submitEntry.mutationFn.mock.calls.at(-1)?.[0] as {
      stageStatuses?: { status: string | null }[];
    };
    expect(sent.stageStatuses?.map((stage) => stage.status)).toEqual([
      "red",
      "yellow",
    ]);
  });

  it("uses the shared readiness projection to block risk-stage coupling", async () => {
    const seeded = makeSection();
    const blocked = {
      ...seeded,
      projects: seeded.projects.map((project) => ({
        ...project,
        trafficLight: "red" as const,
      })),
      risks: [
        {
          id: "99999999-9999-4999-8999-999999999999",
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
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: blocked,
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
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
      screen.getByRole("button", { name: "Submit report" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("alertdialog", { name: "Confirm submission" }),
    ).toBeNull();
  });

  it("a refetch updates the held version without dirtying the form, and the new version reaches the next write", async () => {
    let serverVersion = 1;
    const { Wrapper, captured, queryClient } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: { ...makeSection(), version: serverVersion },
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
    });
    const submitEntry = expectDefined(captured["reports.submit"]);
    submitEntry.mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 6,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    // A concurrent writer advances only the revision; a refetch brings version
    // 5 with identical content. `await act(invalidate)` flushes the refetch AND
    // the re-seed effect, so the held version is deterministically 5 here.
    serverVersion = 5;
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    // Version is not part of the dirty key → the form stays clean (no spurious
    // autosave from the bump).
    expect(screen.getByText("Autosaved")).toBeInTheDocument();

    // And the re-seeded version actually advanced: the next write carries 5,
    // not the initially-loaded 1 — without this, conflict recovery would 409 in
    // a loop.
    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm submission",
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });
    await waitFor(() =>
      expect(submitEntry.mutationFn.mock.calls.length).toBeGreaterThan(0),
    );
    const sent = submitEntry.mutationFn.mock.calls.at(-1)?.[0] as {
      version?: number;
    };
    expect(sent.version).toBe(5);
  });

  it("byPeriod load failure: toast shows prefix + requestId reference", async () => {
    // data.requestId makes formatClientErrorMessage append "Reference: req-X.".
    const err = new TRPCClientError("INTERNAL_SERVER_ERROR");
    Object.defineProperty(err, "data", {
      value: {
        httpStatus: 500,
        code: "INTERNAL_SERVER_ERROR",
        requestId: "req-X",
      },
      configurable: true,
    });

    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () => Promise.reject(err),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to load form. Reference: req-X.",
      ),
    );
  });

  it("byPeriod NOT_FOUND renders an accessible unavailable surface without a toast", async () => {
    const err = new TRPCClientError("No section found for user");
    Object.defineProperty(err, "data", {
      value: { httpStatus: 404, code: "NOT_FOUND" },
      configurable: true,
    });

    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () => Promise.reject(err),
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      render(
        <Wrapper>
          <LeadForm />
        </Wrapper>,
      );

      expect(
        await screen.findByRole("heading", {
          name: /report form unavailable/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        /does not have an editable section/i,
      );
      expect(toast.error).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("changing a stage status marks the form dirty (autosave indicator changes from Autosaved)", async () => {
    // Stage chip click dirties via handleProductsChange → autosave pending.
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    // Single click toggles On Track/unset; skip risk-floored chips (no-op).
    const editableChip = screen.getAllByRole("button").find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return (
        /^(Planning|Analysis|Design|Development|Testing|DevOps|Support): (on-track|empty)/.test(
          label,
        ) && b.getAttribute("aria-disabled") !== "true"
      );
    }) as HTMLButtonElement | undefined;
    expect(editableChip).toBeDefined();
    act(() => {
      expectDefined(editableChip).click();
    });

    // Wait for the dirty indicator to replace "Autosaved".
    await waitFor(() =>
      expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull(),
    );

    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull();
  });

  it("same-payload refetch preserves unsaved local draft edits", async () => {
    let serverVersion = 1;
    const { Wrapper, queryClient } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: { ...makeSection(), version: serverVersion },
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    const editableChip = screen.getAllByRole("button").find((button) => {
      const label = button.getAttribute("aria-label") ?? "";
      return (
        /^(Planning|Analysis|Design|Development|Testing|DevOps|Support): (on-track|empty)/.test(
          label,
        ) && button.getAttribute("aria-disabled") !== "true"
      );
    }) as HTMLButtonElement | undefined;
    expect(editableChip).toBeDefined();
    act(() => {
      expectDefined(editableChip).click();
    });

    await waitFor(() =>
      expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull(),
    );

    // React Query may refetch the same server payload while the local debounce
    // is still pending. That refetch must update the held version but must not
    // reseed the draft mirror and erase the unsaved edit.
    serverVersion = 2;
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull();
  });
});
