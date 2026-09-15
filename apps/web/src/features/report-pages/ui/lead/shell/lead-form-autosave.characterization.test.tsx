// Keep fake-timer cadence pins separate: RTL `waitFor` can deadlock in this
// suite when it shares the same timer lifecycle.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { invalidateLeadForm } from "../../../../../shared/lib/query/cache-keys";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

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

function makeSection() {
  return makeLeadFormSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    version: 1,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        ownedStages: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 3 },
        ],
        stageSet: [
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
        stageNames: ["Development"],
        tag: "tag",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
      },
    ],
  });
}

function buildHarness(
  section: () =>
    | ReturnType<typeof makeSection>
    | Promise<ReturnType<typeof makeSection>> = makeSection,
) {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["ai", "availability"],
      query: { availability: "not_configured" },
    },
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
        authorRole: "lead" as const,
      },
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      query: async () => ({
        section: await section(),
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);
  expectDefined(captured["reports.saveDraft"]).mutationFn.mockResolvedValue({
    ...makeSection(),
    version: 2,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider
          value={{
            user: {
              id: AUTHOR_ID,
              name: "Test Lead",
              email: "lead@example.com",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, captured };
}

async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

async function renderLoaded(
  section: () =>
    | ReturnType<typeof makeSection>
    | Promise<ReturnType<typeof makeSection>> = makeSection,
) {
  const harness = buildHarness(section);
  render(
    <harness.Wrapper>
      <LeadForm />
    </harness.Wrapper>,
  );
  // Let the query cascade resolve through the mock proxy.
  await flush();
  await flush();
  await flush();
  expect(screen.queryByText("Autosaved")).not.toBeNull();
  return harness;
}

function clickEditableStageChip() {
  const chip = screen.getAllByRole("button").find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return (
      /^Development: (On track|No status)/.test(label) &&
      button.getAttribute("aria-disabled") !== "true"
    );
  });
  if (!chip) throw new Error("no editable stage chip rendered");
  act(() => chip.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("lead-form draft: autosave cadence", () => {
  it("issues no save while the freshly loaded draft is clean", async () => {
    const { captured } = await renderLoaded();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("debounces a dirty edit, then fires exactly one save after the window", async () => {
    const { captured } = await renderLoaded();

    clickEditableStageChip();
    // Before the 5s debounce elapses no save is issued.
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).not.toHaveBeenCalled();
    // After the full window exactly one save fires.
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).toHaveBeenCalledTimes(1);
  });

  it("Save now flushes immediately, before the debounce elapses", async () => {
    const { captured } = await renderLoaded();

    clickEditableStageChip();
    await flush();
    const saveButton = screen
      .getAllByRole("button")
      .find((b) => /Save draft now/i.test(b.getAttribute("aria-label") ?? ""));
    if (!saveButton) throw new Error("no Save-now button rendered");
    act(() => saveButton.click());
    await flush();
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).toHaveBeenCalledTimes(1);
  });

  it("preserves edits typed during a same-save echo and autosaves them with its version", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    let serverSection = makeSection();
    let queryCount = 0;
    let resolveRefetch!: (section: ReturnType<typeof makeSection>) => void;
    const refetchSection = new Promise<ReturnType<typeof makeSection>>(
      (resolve) => {
        resolveRefetch = resolve;
      },
    );
    const { Wrapper, captured } = buildHarness(() =>
      queryCount++ === 0 ? serverSection : refetchSection,
    );
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    let resolveFirstSave!: (section: ReturnType<typeof makeSection>) => void;
    const saveDraft = expectDefined(captured["reports.saveDraft"]).mutationFn;
    saveDraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstSave = resolve;
        }),
    );
    vi.mocked(invalidateLeadForm).mockImplementationOnce((queryClient) => {
      void queryClient.invalidateQueries();
    });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const firstDescription = screen.getByRole("textbox", {
      name: /Description/,
    });
    await user.clear(firstDescription);
    await user.type(firstDescription, "Saved A");
    await user.click(screen.getByRole("button", { name: "Save Item" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1), {
      timeout: 7000,
    });
    expect(saveDraft.mock.calls[0]?.[0]).toMatchObject({
      version: 1,
      items: [{ text: "Saved A" }],
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const secondDescription = screen.getByRole("textbox", {
      name: /Description/,
    });
    await user.clear(secondDescription);
    await user.type(secondDescription, "Local B");
    await user.click(screen.getByRole("button", { name: "Save Item" }));
    expect(screen.getByText("Local B")).toBeInTheDocument();

    const savedA = {
      ...makeSection(),
      version: 2,
      items: makeSection().items.map((item) => ({ ...item, text: "Saved A" })),
    };
    serverSection = savedA;
    act(() => {
      resolveFirstSave(savedA);
    });
    await vi.waitFor(() => expect(queryCount).toBeGreaterThanOrEqual(2));
    expect(screen.getByText("Local B")).toBeInTheDocument();
    await act(() => {
      resolveRefetch(serverSection);
      return Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(screen.getByText("Local B")).toBeInTheDocument(),
    );
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2), {
      timeout: 7000,
    });
    expect(saveDraft.mock.calls[1]?.[0]).toMatchObject({
      version: 2,
      items: [{ text: "Local B" }],
    });
  }, 15_000);

  it("surfaces a conflict when a newer external refetch arrives during dirty editing", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    let queryCount = 0;
    let resolveRefetch!: (section: ReturnType<typeof makeSection>) => void;
    const refetchSection = new Promise<ReturnType<typeof makeSection>>(
      (resolve) => {
        resolveRefetch = resolve;
      },
    );
    const { Wrapper, captured } = buildHarness(() =>
      queryCount++ === 0 ? makeSection() : refetchSection,
    );
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    let resolveFirstSave!: (section: ReturnType<typeof makeSection>) => void;
    const saveDraft = expectDefined(captured["reports.saveDraft"]).mutationFn;
    saveDraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstSave = resolve;
        }),
    );
    vi.mocked(invalidateLeadForm).mockImplementationOnce((queryClient) => {
      void queryClient.invalidateQueries();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const firstDescription = screen.getByRole("textbox", {
      name: /Description/,
    });
    await user.clear(firstDescription);
    await user.type(firstDescription, "Saved A");
    await user.click(screen.getByRole("button", { name: "Save Item" }));
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1), {
      timeout: 7000,
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const secondDescription = screen.getByRole("textbox", {
      name: /Description/,
    });
    await user.clear(secondDescription);
    await user.type(secondDescription, "Local B");
    await user.click(screen.getByRole("button", { name: "Save Item" }));
    expect(screen.getByText("Local B")).toBeInTheDocument();

    const savedA = {
      ...makeSection(),
      version: 2,
      items: makeSection().items.map((item) => ({ ...item, text: "Saved A" })),
    };
    const external = {
      ...savedA,
      version: 3,
      items: savedA.items.map((item) => ({ ...item, text: "External C" })),
    };
    act(() => {
      resolveFirstSave(savedA);
    });
    await vi.waitFor(() => expect(queryCount).toBeGreaterThanOrEqual(2));
    await act(() => {
      resolveRefetch(external);
      return Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This section was changed elsewhere. Reloaded the latest version — re-apply your changes and save again.",
      ),
    );
    expect(screen.getByText("External C")).toBeInTheDocument();
    expect(screen.queryByText("Local B")).toBeNull();
  }, 15_000);
});
