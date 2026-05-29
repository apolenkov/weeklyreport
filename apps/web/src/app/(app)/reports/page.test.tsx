/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
  Role,
} from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../../../components/search/search-input", () => ({
  SearchInput: ({ placeholder }: { readonly placeholder?: string }) => (
    <input aria-label="Search Reports" placeholder={placeholder} />
  ),
}));

vi.mock("../../../lib/session-provider", () => ({
  useSession: () => sessionMock(),
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    reports: {
      myHistory: {
        queryOptions: () => ({ queryKey: ["reports.myHistory"] }),
      },
      compiledHistory: {
        queryOptions: (input: { includeArchive?: boolean }) => ({
          queryKey: ["reports.compiledHistory", input.includeArchive ?? false],
        }),
      },
    },
  }),
}));

type QueryOptions = {
  readonly queryKey: readonly unknown[];
  readonly enabled?: boolean;
};

function setRole(role: Role) {
  sessionMock.mockReturnValue({
    user: { id: "u1", name: "Test User", email: "t@test.local", role },
  });
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
    versionCount: 1,
    latestVersion: 1,
    latestVersionAt: new Date("2026-05-15T09:00:00.000Z"),
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
      return {
        data: {
          entries: includeArchive
            ? [currentCompiled, archivedCompiled]
            : [currentCompiled],
          archiveCount: 1,
        },
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    throw new Error("Unexpected query " + String(name));
  });
}

describe("ReportsPage history archive toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.searchParams = new URLSearchParams("tab=drafts");
    mockQueries();
  });

  it("hides lead archived rows until Show archive is checked", () => {
    setRole("lead");
    render(<ReportsPage />);

    expect(screen.getByText("Week 20, May 11–17, 2026")).toBeInTheDocument();
    expect(
      screen.queryByText("Week 15, Apr 6–12, 2026"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show archived reports (1)"));

    expect(screen.getByText("Week 15, Apr 6–12, 2026")).toBeInTheDocument();
    expect(navigationMock.push).toHaveBeenCalledWith("/reports?tab=published", {
      scroll: false,
    });
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
  });
});
