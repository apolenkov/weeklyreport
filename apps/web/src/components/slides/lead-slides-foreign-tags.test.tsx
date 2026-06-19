/**
 * @vitest-environment jsdom
 *
 * close-slides-visibility-tails (tail 2): the per-author-row-tags Coming-Soon
 * affordance in the lead slide deck. It renders ONLY on the lead's own deck, in
 * Everyone, in the own-scope bullet view, and is hidden in fullscreen
 * presentation. Rendering `LeadSlidesClient` directly (visibility is a prop)
 * also gives the slide host its own coverage of the own-deck gate (Codex
 * round-2 finding 1) without a localStorage round-trip.
 */

import "@testing-library/jest-dom/vitest";

import type { MyHistoryEntry } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../lib/session-provider";
import { TRPCProxyContext } from "../../lib/trpc-context";
import { createDemoSection } from "../../test-utils/fixtures";
import { createMockTRPC } from "../../test-utils/mock-trpc";
import { LeadSlidesClient } from "./lead-slides-client";

const TESTID = "foreign-tags-coming-soon";

// Aligns with createDemoSection(): reportId 2222…, sectionId 1111…, authorId 3333….
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const OWN_USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";

const navState = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => navState.searchParams,
  usePathname: () => "/lead/report",
}));

const HISTORY_ENTRY: MyHistoryEntry = {
  reportId: REPORT_ID,
  sectionId: SECTION_ID,
  periodStart: new Date("2026-06-15T00:00:00.000Z"),
  periodEnd: new Date("2026-06-21T00:00:00.000Z"),
  reportStatus: "draft",
  sectionStatus: "draft",
  submittedAt: null,
  publishedAt: null,
  archived: false,
  itemCount: 1,
  riskCount: 0,
  productCount: 1,
};

function buildHarness() {
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Lead 1",
      },
    },
    { path: ["reports", "myHistory"], query: [HISTORY_ENTRY] },
    {
      path: ["leadForm", "byPeriod"],
      query: () => ({ section: createDemoSection(), readOnly: false }),
    },
    { path: ["leadForm", "crossAuthors"], query: () => [] },
    { path: ["leadForm", "crossAuthorContent"], query: () => [] },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({
    children,
    userId = OWN_USER_ID,
  }: {
    children: ReactNode;
    userId?: string;
  }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <SessionContext.Provider
            value={{
              user: {
                id: userId,
                name: "Lead 1",
                email: "lead@example.test",
                role: "lead",
              },
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            {children}
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper };
}

function setFullscreen(on: boolean): void {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: on ? document.body : null,
  });
  act(() => {
    document.dispatchEvent(new Event("fullscreenchange"));
  });
}

beforeEach(() => {
  navState.searchParams = new URLSearchParams();
});

afterEach(() => {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

describe("lead slides — per-author-tags Coming-Soon affordance", () => {
  it("renders on the own deck in Everyone (own-scope, non-fullscreen)", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadSlidesClient visibilityMode="everyone" visibilityHydrated />
      </Wrapper>,
    );
    expect(await screen.findByTestId(TESTID)).toBeInTheDocument();
  });

  it("is absent in Mine on the own deck", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadSlidesClient visibilityMode="mine" visibilityHydrated />
      </Wrapper>,
    );
    // The "Summary" scope control proves the deck's hero controls mounted, so
    // the affordance's absence is meaningful (not just "not rendered yet").
    await screen.findByRole("radio", { name: "Summary" });
    expect(screen.queryByTestId(TESTID)).toBeNull();
  });

  it("is absent on a foreign deck even with visibilityMode=everyone (own-deck gate)", async () => {
    navState.searchParams = new URLSearchParams(`authorId=${OTHER_USER_ID}`);
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadSlidesClient visibilityMode="everyone" visibilityHydrated />
      </Wrapper>,
    );
    // The "Summary" scope control proves the deck's hero controls mounted, so
    // the affordance's absence is meaningful (not just "not rendered yet").
    await screen.findByRole("radio", { name: "Summary" });
    expect(screen.queryByTestId(TESTID)).toBeNull();
  });

  it("is hidden in fullscreen presentation (round-2 finding 2)", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadSlidesClient visibilityMode="everyone" visibilityHydrated />
      </Wrapper>,
    );
    expect(await screen.findByTestId(TESTID)).toBeInTheDocument();
    setFullscreen(true);
    await waitFor(() => {
      expect(screen.queryByTestId(TESTID)).toBeNull();
    });
  });
});
