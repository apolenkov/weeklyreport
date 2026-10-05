// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
  Role,
} from "@customreport/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionState } from "../../../shared/lib/auth/session-provider";
import ReportsPage from "./page";

const navigationMock = vi.hoisted(() => ({
  searchParams: new URLSearchParams("tab=drafts"),
  push: vi.fn(),
}));

const sessionMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationMock.push }),
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn(),
    useInfiniteQuery: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../../../shared/ui/search/search-input", () => ({
  SearchInput: ({
    placeholder,
    scope,
  }: {
    readonly placeholder?: string;
    readonly scope?: string;
  }) => (
    <input
      aria-label="Search Reports"
      placeholder={placeholder}
      data-scope={scope}
    />
  ),
}));

vi.mock("../../../shared/lib/auth/session-provider", () => ({
  useSession: (): SessionState => sessionMock() as SessionState,
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      myHistory: {
        queryOptions: () => ({ queryKey: ["reports.myHistory"] }),
        infiniteQueryOptions: () => ({
          queryKey: ["reports.myHistory"],
          initialPageParam: undefined,
          getNextPageParam: () => null,
        }),
      },
      compiledHistory: {
        queryOptions: (input: { includeArchive?: boolean }) => ({
          queryKey: ["reports.compiledHistory", input.includeArchive ?? false],
        }),
      },
    },
  }),
}));

interface QueryOptions {
  readonly queryKey: readonly unknown[];
  readonly enabled?: boolean;
  readonly placeholderData?: (
    previousData: CompiledHistoryData | undefined,
  ) => CompiledHistoryData | undefined;
}

interface CompiledHistoryData {
  readonly entries: CompiledHistoryEntry[];
  readonly archiveCount: number;
}

let pendingCompiledArchive: boolean | null = null;
let previousCompiledData: CompiledHistoryData | undefined;

function setRole(role: Role) {
  sessionMock.mockReturnValue({
    user: { id: "u1", name: "Test User", email: "t@test.local", role },
    organization: null,
    isAuthenticated: true,
    isLoading: false,
  } satisfies SessionState);
}

function historyEntry(overrides: Partial<MyHistoryEntry>): MyHistoryEntry {
  return {
    sectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    periodStart: new Date("2026-05-11T00:00:00.000Z"),
    periodEnd: new Date("2026-05-17T23:59:59.000Z"),
    reportStatus: "draft",
    sectionStatus: "submitted",
    archived: false,
    submittedAt: new Date("2026-05-15T09:00:00.000Z"),
    publishedAt: null,
    createdAt: new Date("2026-05-15T08:00:00.000Z"),
    updatedAt: new Date("2026-05-15T09:00:00.000Z"),
    lastEditAt: new Date("2026-05-15T09:00:00.000Z"),
    itemCount: 1,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    productCount: 1,
    trafficLights: { green: 1, yellow: 0, red: 0 },
    ...overrides,
  };
}

const currentLead = historyEntry({});
const archivedLead = historyEntry({
  sectionId: "33333333-3333-4333-8333-333333333333",
  reportId: "44444444-4444-4444-8444-444444444444",
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.000Z"),
  reportStatus: "published",
  archived: true,
  publishedAt: new Date("2026-04-13T09:00:00.000Z"),
});

const currentCompiled: CompiledHistoryEntry = {
  reportId: "55555555-5555-4555-8555-555555555555",
  periodStart: new Date("2026-05-04T00:00:00.000Z"),
  periodEnd: new Date("2026-05-10T23:59:59.000Z"),
  publishedAt: new Date("2026-05-11T09:00:00.000Z"),
  archived: false,
  reopened: false,
  publishedByName: "Head User",
  trafficLights: { green: 2, yellow: 0, red: 0 },
  itemCount: 2,
  riskCount: 0,
  decisionCount: 1,
  priorityCount: 1,
  sectionCount: 2,
  productCount: 2,
};

const archivedCompiled: CompiledHistoryEntry = {
  ...currentCompiled,
  reportId: "66666666-6666-4666-8666-666666666666",
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.000Z"),
  publishedAt: new Date("2026-04-13T09:00:00.000Z"),
  archived: true,
};

function mockQueries() {
  const data = {
    pages: [{ items: [currentLead, archivedLead], nextCursor: null }],
    pageParams: [null],
  };
  const result = {
    data,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    isEnabled: true,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    isFetchPreviousPageError: false,
    isFetchingPreviousPage: false,
    status: "success",
    fetchStatus: "idle",
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
    refetch: vi.fn(),
  } satisfies ReturnType<typeof useInfiniteQuery>;
  vi.mocked(useInfiniteQuery).mockReturnValue(result);
  vi.mocked(useQuery).mockImplementation((options: unknown) => {
    const query = options as QueryOptions;
    if (query.enabled === false) {
      return {
        data: undefined,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    const [name, includeArchive] = query.queryKey;
    if (name === "reports.myHistory") {
      return {
        data: [currentLead, archivedLead],
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    if (name === "reports.compiledHistory") {
      const freshData = {
        entries: includeArchive
          ? [currentCompiled, archivedCompiled]
          : [currentCompiled],
        archiveCount: 1,
      };
      if (pendingCompiledArchive === includeArchive) {
        const placeholder = query.placeholderData?.(previousCompiledData);
        return {
          data: placeholder,
          isLoading: placeholder === undefined,
          isError: false,
        } as ReturnType<typeof useQuery>;
      }
      previousCompiledData = freshData;
      return {
        data: freshData,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    throw new Error(`Unexpected query ${String(name)}`);
  });
}

describe("ReportsPage history archive toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.searchParams = new URLSearchParams("tab=drafts");
    pendingCompiledArchive = null;
    previousCompiledData = undefined;
    mockQueries();
  });

  it.each(["lead", "head", "admin", "viewer"] as const)(
    "waits for the session before showing %s history",
    (role) => {
      sessionMock.mockReturnValue({
        user: null,
        organization: null,
        isAuthenticated: false,
        isLoading: true,
      } satisfies SessionState);
      const { rerender } = render(<ReportsPage />);

      expect(
        screen.getByRole("status", { name: "Loading history" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("history-empty-state"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("history-panel-grid"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/History Summary/)).not.toBeInTheDocument();
      expect(vi.mocked(useInfiniteQuery).mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ enabled: false }),
      );
      expect(vi.mocked(useQuery).mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ enabled: false }),
      );

      setRole(role);
      rerender(<ReportsPage />);

      expect(
        screen.queryByRole("status", { name: "Loading history" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          role === "lead"
            ? "Week 20, May 11–17, 2026"
            : "Week 19, May 4–10, 2026",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("history-empty-state"),
      ).not.toBeInTheDocument();
    },
  );

  it("hides lead archived rows until Show archive is checked", () => {
    setRole("lead");
    render(<ReportsPage />);

    expect(screen.getByText("Week 20, May 11–17, 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Week 15, Apr 6–12, 2026"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show archived reports (1)"));

    expect(screen.getByText("Week 15, Apr 6–12, 2026")).toBeInTheDocument();
    // Toggling archive is local state only — it must not push the URL.
    expect(navigationMock.push).not.toHaveBeenCalled();
  });

  it("uses compiled history for head and expands archived rows", () => {
    setRole("head");
    render(<ReportsPage />);

    expect(
      screen.getByText("Compiled group report history."),
    ).toBeInTheDocument();
    expect(screen.getByText("Week 19, May 4–10, 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Week 15, Apr 6–12, 2026"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show archived reports (1)"));

    expect(screen.getByText("Week 15, Apr 6–12, 2026")).toBeInTheDocument();
    // Head archive toggle is URL-stable (no push).
    expect(navigationMock.push).not.toHaveBeenCalled();
  });

  it("keeps the previous compiled list while archive refetches in both directions", () => {
    setRole("head");
    const rendered = render(<ReportsPage />);
    const archiveToggle = screen.getByLabelText("Show archived reports (1)");

    pendingCompiledArchive = true;
    fireEvent.click(archiveToggle);
    expect(screen.getByText("Week 19, May 4–10, 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Week 15, Apr 6–12, 2026"),
    ).not.toBeInTheDocument();

    pendingCompiledArchive = null;
    rendered.rerender(<ReportsPage />);
    expect(screen.getByText("Week 15, Apr 6–12, 2026")).toBeInTheDocument();

    pendingCompiledArchive = false;
    fireEvent.click(archiveToggle);
    expect(screen.getByText("Week 15, Apr 6–12, 2026")).toBeInTheDocument();
  });

  it("titles the viewer summary as portfolio-wide, not as personal stats (R34)", () => {
    setRole("viewer");
    render(<ReportsPage />);

    expect(
      screen.getByRole("complementary", { name: "Portfolio History Summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Periods completed")).toBeInTheDocument();
  });

  it("renders the published-scoped search for a viewer", () => {
    setRole("viewer");
    render(<ReportsPage />);

    const search = screen.getByLabelText("Search Reports");
    expect(search).toHaveAttribute("data-scope", "published");
    expect(search).toHaveAttribute("placeholder", "Search published reports…");
  });

  it("defaults head History to NO archive even when the URL is ?tab=published", () => {
    // The nav link for head/viewer is literally ?tab=published, yet History
    // must still land on the current (non-archived) view. The URL does not
    // force archive on.
    setRole("head");
    navigationMock.searchParams = new URLSearchParams("tab=published");
    render(<ReportsPage />);

    expect(screen.getByText("Week 19, May 4–10, 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Week 15, Apr 6–12, 2026"),
    ).not.toBeInTheDocument();
  });
});
