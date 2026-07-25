/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
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
      },
    },
    {
      path: ["reports", "myHistory"],
      query: [],
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
      <TRPCProxyContext.Provider value={buildTRPC()}>
        {children}
      </TRPCProxyContext.Provider>
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

    // Snapshot the explicit segmented-control boundary so a missing wrapper
    // fails clearly instead of silently changing the snapshot subject.
    expect(screen.getByRole("group", { name: "View mode" })).toMatchSnapshot();
  });
});
