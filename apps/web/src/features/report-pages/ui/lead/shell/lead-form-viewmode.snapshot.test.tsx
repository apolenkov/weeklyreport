// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

const REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeSection() {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    authorName: "Test Lead",
    authorRole: "lead" as const,
    status: "draft" as const,
    submittedAt: null,
    referencedProjects: [],
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  };
}

function buildTRPC() {
  const { proxy } = createMockTRPC([
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
      query: { items: [] },
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
      query: {
        section: makeSection(),
        readOnly: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      },
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
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
  ]);
  return proxy;
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <SessionContext.Provider
        value={{
          user: {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            name: "Test Lead",
            email: "lead@example.com",
            role: "lead",
          },
          organization: null,
          isLoading: false,
          isAuthenticated: true,
        }}
      >
        <TRPCProxyContext.Provider value={buildTRPC()}>
          <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
        </TRPCProxyContext.Provider>
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

describe("LeadForm view-mode toggle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("shows Edit link and Slides link in edit mode", async () => {
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="edit" />
      </Wrapper>,
    );

    // findByRole is act-wrapped by RTL — waits for the query cascade to settle.
    const editLink = await screen.findByRole("link", { name: /^Edit$/i });
    const slidesLink = screen.queryByRole("link", {
      name: /^Slides$/i,
    });

    expect(editLink).toBeInTheDocument();
    expect(slidesLink).toBeInTheDocument();

    expect(editLink).toHaveAttribute(
      "href",
      `/lead/report/${encodeURIComponent(REPORT_ID)}`,
    );
    expect(slidesLink).toHaveAttribute(
      "href",
      `/lead/report/${encodeURIComponent(REPORT_ID)}?mode=slides`,
    );
    for (const link of [editLink, slidesLink]) {
      expect(link).toHaveClass(
        "max-md:min-h-[var(--touch-target-min)]",
        "max-md:min-w-[var(--touch-target-min)]",
      );
    }

    // Snapshot the explicit segmented-control boundary so a missing wrapper
    // fails clearly instead of silently changing the snapshot subject.
    expect(screen.getByRole("group", { name: "View mode" })).toMatchSnapshot();
  });
});
