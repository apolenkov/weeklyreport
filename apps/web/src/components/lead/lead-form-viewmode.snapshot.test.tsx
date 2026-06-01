/**
 * @vitest-environment jsdom
 *
 * Pre-extract snapshot: ViewModeToggle [Edit | Slides] pill pair in LeadForm.
 * Baseline before Wave 1 A1 extracts this markup to report-shell/view-mode-toggle.tsx.
 * After extraction, these tests must pass without changes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCProxyContext } from "../../lib/trpc-context";
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
  };
}

function buildTRPC() {
  return {
    reports: {
      getActive: {
        queryOptions: () => ({
          queryKey: ["reports.getActive"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
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
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ["reports.myHistory"] }),
      },
      saveDraft: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["reports.saveDraft"] }),
      },
      submit: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["reports.submit"] }),
      },
    },
    leadForm: {
      byPeriod: {
        queryOptions: () => ({
          queryKey: ["leadForm.byPeriod"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => ({ section: makeSection(), readOnly: false }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.byPeriod"] }),
      },
      versions: {
        queryOptions: () => ({
          queryKey: ["leadForm.versions"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.versions"] }),
      },
      revoke: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.revoke"] }),
      },
      fillFrom: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.fillFrom"] }),
      },
      restoreVersion: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.restoreVersion"] }),
      },
      createSnapshot: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.createSnapshot"] }),
      },
      requestReopen: {
        mutationOptions: (p: object = {}) => ({
          ...p,
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC mutationFn contract (no awaitable work in the stub)
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.requestReopen"] }),
      },
      crossAuthors: {
        queryOptions: () => ({
          queryKey: ["leadForm.crossAuthors"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => [] as never[],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.crossAuthors"] }),
      },
      crossAuthorSections: {
        queryOptions: () => ({
          queryKey: ["leadForm.crossAuthorSections"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => [] as never[],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.crossAuthorSections"] }),
      },
      getVersion: {
        queryOptions: () => ({
          queryKey: ["leadForm.getVersion"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async tRPC queryFn contract (no awaitable work in the stub)
          queryFn: async () => null,
        }),
        pathFilter: () => ({ queryKey: ["leadForm.getVersion"] }),
      },
    },
  };
}

async function flushAll() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <TRPCProxyContext.Provider value={buildTRPC() as never}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}

describe("LeadForm view-mode toggle — pre-extract snapshot", () => {
  afterEach(() => {
    document.title = "";
  });

  it("shows Edit link and Slides link in edit mode", async () => {
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="edit" />
      </Wrapper>,
    );

    await act(flushAll);

    const editLink = screen.queryByRole("link", { name: /^Edit$/i });
    const slidesLink = screen.queryByRole("link", {
      name: /Open slides mode/i,
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

    // Snapshot the pill pair container for structural regression guard.
    const pillPair = slidesLink?.closest('[class*="rounded-r"]')?.parentElement;
    expect(pillPair ?? slidesLink).toMatchSnapshot();
  });
});
