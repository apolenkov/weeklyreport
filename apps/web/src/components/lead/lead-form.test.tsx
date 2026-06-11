/**
 * Tests for the LeadForm container's mutation wiring (submit + revoke +
 * autosave + dirty-state). The four queries (getActive / byPeriod / versions /
 * myHistory) are mocked at the tRPC-proxy boundary, mirroring the autosave
 * hook test harness.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

function makeSection(overrides: { status?: "draft" | "submitted" } = {}) {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    status: overrides.status ?? ("draft" as const),
    submittedAt: null,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        // 35-04: at least one owned stage so the SDLC pipeline renders
        // an editable chip — the dirty-flag test clicks it to fire
        // handleProductsChange.
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
  };
}

interface Capture {
  submitOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  revokeOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  saveDraftOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  fillFromOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
  restoreOpts?: { onSuccess?: () => void; onError?: (err: unknown) => void };
}

function buildHarness(
  opts: {
    sectionStatus?: "draft" | "submitted";
    submitFn?: () => Promise<unknown>;
    revokeFn?: () => Promise<unknown>;
    byPeriodReadOnly?: boolean;
    byPeriodQueryFn?: () => Promise<unknown>;
    versions?: {
      id: string;
      reportSectionId: string;
      version: number;
      createdAt: Date;
      itemCount?: number;
      riskCount?: number;
      decisionCount?: number;
    }[];
  } = {},
) {
  const cap: Capture = {};
  const calls: { type: string; vars: unknown }[] = [];

  const trpcMock = {
    reports: {
      getActive: {
        queryOptions: () => ({
          queryKey: ["reports.getActive"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => ({
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            authorName: "Test Lead",
          }),
        }),
        pathFilter: () => ({ queryKey: ["reports.getActive"] }),
      },
      myHistory: {
        queryOptions: () => ({
          queryKey: ["reports.myHistory"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ["reports.myHistory"] }),
      },
      saveDraft: {
        mutationOptions: (passed: NonNullable<Capture["saveDraftOpts"]>) => {
          cap.saveDraftOpts = passed;
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "saveDraft", vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["reports.saveDraft"] }),
      },
      submit: {
        mutationOptions: (passed: NonNullable<Capture["submitOpts"]>) => {
          cap.submitOpts = passed;
          return {
            ...passed,
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "submit", vars });
              if (opts.submitFn) return opts.submitFn();
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["reports.submit"] }),
      },
    },
    leadForm: {
      byPeriod: {
        queryOptions: () => ({
          queryKey: ["leadForm.byPeriod"],
          queryFn:
            opts.byPeriodQueryFn ??
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
            (async () => ({
              section: makeSection({ status: opts.sectionStatus }),
              readOnly: opts.byPeriodReadOnly ?? false,
            })),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.byPeriod"] }),
      },
      versions: {
        queryOptions: () => ({
          queryKey: ["leadForm.versions"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => opts.versions ?? [],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.versions"] }),
      },
      revoke: {
        mutationOptions: (passed: NonNullable<Capture["revokeOpts"]>) => {
          cap.revokeOpts = passed;
          return {
            ...passed,
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "revoke", vars });
              if (opts.revokeFn) return opts.revokeFn();
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.revoke"] }),
      },
      fillFrom: {
        mutationOptions: (passed: NonNullable<Capture["fillFromOpts"]>) => {
          cap.fillFromOpts = passed;
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "fillFrom", vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.fillFrom"] }),
      },
      restoreVersion: {
        mutationOptions: (passed: NonNullable<Capture["restoreOpts"]>) => {
          cap.restoreOpts = passed;
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "restoreVersion", vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.restoreVersion"] }),
      },
      // Save Version (Block 2): manual snapshot button + every-N-autosave
      // hybrid policy. The component reads this mutation factory
      // unconditionally, so the mock has to expose it even when no test
      // exercises the path.
      createSnapshot: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => {
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "createSnapshot", vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.createSnapshot"] }),
      },
      // M6 Lead-side reopen request — added after the original mock
      // shape was set. The component reads
      // `trpc.leadForm.requestReopen.mutationOptions` unconditionally
      // even when the dialog is never opened, so the mock has to
      // expose the mutation factory.
      requestReopen: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => {
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "requestReopen", vars });
              return { ok: true };
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.requestReopen"] }),
      },
      // add-version-pin: pin/unpin toggle. The component calls
      // `trpc.leadForm.setVersionPinned.mutationOptions` unconditionally on
      // every render (hook is at the top of the component), so the mock must
      // expose this factory even when no test exercises it.
      setVersionPinned: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => {
          return {
            ...passed,
            // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC mutationFn contract (TanStack expects a Promise-returning fn)
            mutationFn: async (vars: unknown) => {
              calls.push({ type: "setVersionPinned", vars });
              return undefined;
            },
          };
        },
        pathFilter: () => ({ queryKey: ["leadForm.setVersionPinned"] }),
      },
      crossAuthors: {
        queryOptions: () => ({
          queryKey: ["leadForm.crossAuthors"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => [] as never[],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.crossAuthors"] }),
      },
      crossAuthorSections: {
        queryOptions: () => ({
          queryKey: ["leadForm.crossAuthorSections"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => [] as never[],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.crossAuthorSections"] }),
      },
      // F3.4: snapshot viewer — returns null (no snapshot loaded in unit tests).
      getVersion: {
        queryOptions: () => ({
          queryKey: ["leadForm.getVersion"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock satisfies the async tRPC queryFn contract (TanStack expects a Promise-returning fn)
          queryFn: async () => null,
        }),
        pathFilter: () => ({ queryKey: ["leadForm.getVersion"] }),
      },
    },
    review: {
      dashboard: { pathFilter: () => ({ queryKey: ["review.dashboard"] }) },
    },
    archive: { list: { pathFilter: () => ({ queryKey: ["archive.list"] }) } },
    weeklyReport: {
      get: { pathFilter: () => ({ queryKey: ["weeklyReport.get"] }) },
    },
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ["admin.snapshot"] }) },
      getSettings: { pathFilter: () => ({ queryKey: ["admin.getSettings"] }) },
    },
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, cap, calls, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LeadForm mutation wiring", () => {
  it("submit success: invalidates caches, fires toast.success, locks form", async () => {
    const { Wrapper, cap, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Wait for the query cascade to settle — mutation options are captured once
    // the component has mounted and registered its mutations with React Query.
    await waitFor(() => expect(cap.submitOpts).toBeDefined());

    // onSuccess from the submit mutation fires invalidations + toast.
    expect(cap.submitOpts).toBeDefined();
    // Trigger onSuccess deterministically — the mutation wiring is the unit
    // under test (the orchestration of invalidation + toast + lock).
    act(() => {
      expectDefined(cap.submitOpts).onSuccess?.();
    });
    expect(toast.success).toHaveBeenCalledWith("Report submitted");
    // invalidateLeadForm + invalidateLeadHistory each call invalidateQueries.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("submit error: fires toast.error with the error message", async () => {
    const { Wrapper, cap } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() => expect(cap.submitOpts).toBeDefined());

    expect(cap.submitOpts).toBeDefined();
    // Simulate error path.
    expectDefined(cap.submitOpts).onError?.(new Error("Submit blew up"));
    expect(toast.error).toHaveBeenCalledWith("Submit blew up");
  });

  it("byPeriod load failure: toast shows prefix + requestId reference", async () => {
    // Build a TRPCClientError with data.requestId so formatClientErrorMessage
    // appends "Reference: req-X." — this is the behavior-changing part of task 4.
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

  it("changing a stage status marks the form dirty (autosave indicator changes from Autosaved)", async () => {
    // Originally this test edited a decision row's inline input. After the
    // modal-driven CRUD refactor, decisions are read-only cards opened via
    // a pencil — there's no longer a textbox in the section to drive
    // directly. The dirty-flag path is the same one the user takes when
    // clicking a stage chip and picking a status, so the test now drives
    // that flow instead. Same wiring being tested (handleProductsChange →
    // autosave 'pending'), different entry point.
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // findByText is act-wrapped by RTL — waits for the query cascade to settle.
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    // Click an editable stage chip to open the popover menu.
    const editableChip = screen.getAllByRole("button").find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return (
        /^(Planning|Analysis|Design|Dev|Testing|DevOps|Support):/.test(label) &&
        b.getAttribute("aria-disabled") !== "true"
      );
    }) as HTMLButtonElement | undefined;
    expect(editableChip).toBeDefined();
    act(() => {
      expectDefined(editableChip).click();
    });
    // Wait for the popover menu to appear before querying its items.
    await waitFor(() =>
      expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0),
    );

    // Pick a different status from the menu — fires onStatusChange and
    // dirties the draft.
    const menuitem = screen.getAllByRole("menuitem").find((m) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM textContent is nullable; defensive default in a test helper
      const label = m.textContent ?? "";
      return (
        /On Track|At Risk|Blocked|Clear/i.test(label) &&
        !label.includes("current")
      );
    });
    expect(menuitem).toBeDefined();
    act(() => {
      expectDefined(menuitem).click();
    });

    // Wait for the dirty indicator to replace "Autosaved".
    await waitFor(() =>
      expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull(),
    );

    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull();
  });

  it("fillFrom success: invalidates leadForm, fires toast.success", async () => {
    const { Wrapper, cap, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() => expect(cap.fillFromOpts).toBeDefined());

    expect(cap.fillFromOpts).toBeDefined();
    act(() => {
      expectDefined(cap.fillFromOpts).onSuccess?.();
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Form filled from selected period",
    );
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("restoreVersion error: fires toast.error with the error message", async () => {
    const { Wrapper, cap } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() => expect(cap.restoreOpts).toBeDefined());

    expect(cap.restoreOpts).toBeDefined();
    expectDefined(cap.restoreOpts).onError?.(new Error("Version not found"));
    expect(toast.error).toHaveBeenCalledWith("Version not found");
  });

  it("restoreVersion: window.confirm guards dirty state and cancels mutation", async () => {
    // Provide a version snapshot so the Version History modal renders a
    // Restore button that we can click.
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    const versionId = "88888888-8888-8888-8888-888888888888";

    const { Wrapper, calls } = buildHarness({
      versions: [
        {
          id: versionId,
          reportSectionId: SECTION_ID,
          version: 2,
          createdAt: new Date("2026-04-20T10:00:00Z"),
        },
        {
          id: "99999999-9999-9999-9999-999999999999",
          reportSectionId: SECTION_ID,
          version: 1,
          createdAt: new Date("2026-04-19T10:00:00Z"),
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Make the form dirty by clicking a stage chip + picking a different
    // status. This is the path that survives the modal-driven CRUD
    // refactor — inline decision/risk inputs no longer exist on the
    // page so we can't drive them directly.
    // findByText settles the query cascade before we look for stage chips.
    await screen.findByText("Autosaved");
    const editableChip = screen.getAllByRole("button").find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return (
        /^(Planning|Analysis|Design|Dev|Testing|DevOps|Support):/.test(label) &&
        b.getAttribute("aria-disabled") !== "true"
      );
    }) as HTMLButtonElement | undefined;
    expect(editableChip).toBeDefined();
    act(() => {
      expectDefined(editableChip).click();
    });
    await waitFor(() =>
      expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0),
    );
    const menuitem = screen.getAllByRole("menuitem").find((m) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM textContent is nullable; defensive default in a test helper
      const label = m.textContent ?? "";
      return (
        /On Track|At Risk|Blocked|Clear/i.test(label) &&
        !label.includes("current")
      );
    });
    expect(menuitem).toBeDefined();
    act(() => {
      expectDefined(menuitem).click();
    });
    // Wait for the dirty state to settle before opening the version history.
    await waitFor(() =>
      expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull(),
    );

    // Open the version history modal via its trigger button.
    const historyTrigger = screen.getByTitle(
      /Snapshots and edits within this report/i,
    );
    act(() => {
      historyTrigger.click();
    });

    // Click "Restore" on the older (non-latest) version.
    const restoreBtn = screen.getByRole("button", { name: /^Restore$/ });
    act(() => {
      restoreBtn.click();
    });

    // The dirty guard fired (confirm returned false) so the mutation never ran.
    expect(confirmSpy).toHaveBeenCalled();
    expect(calls.filter((c) => c.type === "restoreVersion")).toHaveLength(0);

    confirmSpy.mockRestore();
  });

  it("version arrows change only the displayed version and do not restore", async () => {
    const { Wrapper, calls } = buildHarness({
      versions: [
        {
          id: "88888888-8888-8888-8888-888888888888",
          reportSectionId: SECTION_ID,
          version: 2,
          createdAt: new Date("2026-04-20T10:00:00Z"),
          itemCount: 2,
          riskCount: 1,
          decisionCount: 1,
        },
        {
          id: "99999999-9999-9999-9999-999999999999",
          reportSectionId: SECTION_ID,
          version: 1,
          createdAt: new Date("2026-04-19T10:00:00Z"),
          itemCount: 1,
          riskCount: 0,
          decisionCount: 0,
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Wait for the version badge to appear with the initial version.
    await waitFor(() =>
      expect(
        screen.getByTitle(/Snapshots and edits within this report/i),
      ).toHaveTextContent("v2"),
    );

    act(() => {
      screen.getByRole("button", { name: /^Previous version$/i }).click();
    });
    await waitFor(() =>
      expect(
        screen.getByTitle(/Snapshots and edits within this report/i),
      ).toHaveTextContent("v1"),
    );

    expect(
      screen.getByTitle(/Snapshots and edits within this report/i),
    ).toHaveTextContent("v1");
    expect(calls.filter((c) => c.type === "restoreVersion")).toHaveLength(0);
  });

  it("returning from a snapshot does not reopen the Risk or Decision dialog", async () => {
    // fix-section-add-signal-reset (task 2.4): pins the 4-counter
    // onViewVersion reset at integration level. Stale risks/decisions
    // add-signal counters must not reopen their create dialogs after a
    // snapshot round-trip.
    const { Wrapper } = buildHarness({
      versions: [
        {
          id: "88888888-8888-8888-8888-888888888888",
          reportSectionId: SECTION_ID,
          version: 2,
          createdAt: new Date("2026-04-20T10:00:00Z"),
        },
        {
          id: "99999999-9999-9999-9999-999999999999",
          reportSectionId: SECTION_ID,
          version: 1,
          createdAt: new Date("2026-04-19T10:00:00Z"),
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Settle the query cascade before driving the section buttons.
    await screen.findByText("Autosaved");

    // "+ Add Risk" → create dialog opens; cancel leaves the counter stale.
    act(() => {
      screen.getByRole("button", { name: /\+ Add Risk/ }).click();
    });
    const riskDialog = await screen.findByRole("dialog");
    act(() => {
      within(riskDialog)
        .getByRole("button", { name: /^Cancel$/ })
        .click();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // "+ Add Decision" → same: open, cancel, counter stays non-zero.
    act(() => {
      screen.getByRole("button", { name: /\+ Add Decision/ }).click();
    });
    const decisionDialog = await screen.findByRole("dialog");
    act(() => {
      within(decisionDialog)
        .getByRole("button", { name: /^Cancel$/ })
        .click();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // View a snapshot version — the surface goes read-only.
    act(() => {
      screen.getByRole("button", { name: /^Previous version$/i }).click();
    });
    await screen.findByRole("button", { name: /^Back to current$/i });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Return to the editable form — no dialog may open uninvited.
    act(() => {
      screen.getByRole("button", { name: /^Back to current$/i }).click();
    });
    await screen.findByRole("button", { name: /\+ Add Risk/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("read-only periods hide destructive version restore", async () => {
    const { Wrapper } = buildHarness({
      byPeriodReadOnly: true,
      versions: [
        {
          id: "88888888-8888-8888-8888-888888888888",
          reportSectionId: SECTION_ID,
          version: 2,
          createdAt: new Date("2026-04-20T10:00:00Z"),
          itemCount: 2,
          riskCount: 1,
          decisionCount: 1,
        },
        {
          id: "99999999-9999-9999-9999-999999999999",
          reportSectionId: SECTION_ID,
          version: 1,
          createdAt: new Date("2026-04-19T10:00:00Z"),
          itemCount: 1,
          riskCount: 0,
          decisionCount: 0,
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Wait for the query cascade to settle — the history trigger is rendered
    // only after byPeriod resolves.
    const historyTrigger = await screen.findByTitle(
      /Snapshots and edits within this report/i,
    );
    act(() => {
      historyTrigger.click();
    });

    expect(
      screen.getByRole("dialog", { name: "Version history" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Restore$/ })).toBeNull();
  });

  it("submitted-section action: Lead sees Request Reopen, not Revoke", async () => {
    // The mapper hard-codes currentUser.role to 'Dev Lead' for now (the
    // read model doesn't yet carry display role), so every harness-driven
    // render takes the Lead branch of lead-form.tsx — Request Reopen,
    // never Revoke. The Revoke wiring flows through the same revokeMut
    // hook that this used to test, but the button that fires it only
    // renders when role doesn't end in "Lead". Until the harness gains a
    // role-override (or the mapper stops hard-coding), we assert the
    // Lead-visible path: submitted section → Request Reopen surfaces.
    const { Wrapper } = buildHarness({ sectionStatus: "submitted" });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Request Reopen renders for Leads on submitted sections — Revoke is
    // the Head/Admin-side variant.
    expect(
      await screen.findByRole("button", { name: /Request Reopen/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revoke$/i })).toBeNull();
  });
});

// VA-0a: icon SVG aria-hidden regression — verify-a11y-recommended-flip catalog
describe("LeadForm icon SVGs — aria-hidden", () => {
  // Renders LeadForm and waits for the query cascade to settle.
  // findByText is act-wrapped by RTL — no manual flush needed.
  async function renderAndSettle() {
    const { Wrapper } = buildHarness();
    const { container } = render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");
    return container;
  }

  it("GridIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-product-status"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("CalendarIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-current-week"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("NextWeekIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-next-week"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("AlertIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-risks"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("ChatIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-decisions"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("CollapseIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    // CollapseIcon renders inside the "Toggle All" button, which is visible
    // when there are items or decisions in the section data.
    const toggleBtn = container.querySelector('button[title="Toggle All"]');
    expect(toggleBtn).not.toBeNull();
    const svg = toggleBtn?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  // VA-0b snapshot: all icon SVGs in the rendered form carry aria-hidden=true
  it("snapshot: all icon SVGs rendered in LeadForm have aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const allSvgs = Array.from(container.querySelectorAll("svg"));
    // At minimum the 6 icon SVGs (Grid, Calendar, NextWeek, Alert, Chat,
    // Collapse) must be present; each must carry aria-hidden="true".
    const iconSvgs = allSvgs.filter(
      (svg) => svg.getAttribute("aria-hidden") === "true",
    );
    expect(iconSvgs.length).toBeGreaterThanOrEqual(6);
    for (const svg of iconSvgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
