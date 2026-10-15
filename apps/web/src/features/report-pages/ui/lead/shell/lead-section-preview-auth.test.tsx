// Loading branch must reuse WeeklyReportSkeleton so SSR Suspense fallback matches.
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` because the mock factory is hoisted above this module's body.
const { authMe } = vi.hoisted(() => ({
  authMe: { queryFn: (): Promise<unknown> => new Promise(() => undefined) },
}));

vi.mock("../../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({
          queryKey: ["auth", "me"],
          queryFn: () => authMe.queryFn(),
        }),
      },
    },
  }),
}));

// The report page itself is out of scope; record which author it receives.
vi.mock("../../weekly/weekly-report-page", () => ({
  WeeklyReportPage: ({ authorId }: { readonly authorId?: string }) => (
    <div data-testid="weekly-report-page">{authorId ?? "no-author"}</div>
  ),
}));

import { LeadSectionPreviewAuth } from "./lead-section-preview-auth";

const clients: QueryClient[] = [];

function wrapperWith(client: QueryClient) {
  clients.push(client);
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients) client.clear();
  clients.length = 0;
});

describe("LeadSectionPreviewAuth", () => {
  it("renders the shared WeeklyReportSkeleton while auth.me is loading", () => {
    authMe.queryFn = () => new Promise(() => undefined);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(<LeadSectionPreviewAuth reportId="r1" />, {
      wrapper: wrapperWith(client),
    });

    expect(screen.getByTestId("weekly-report-skeleton")).toBeInTheDocument();
  });

  it("keeps the skeleton while the retry after a failed first auth.me is paused offline", async () => {
    // Real producer: the first auth.me fails, then the browser goes offline
    // before the retry, so the query stays pending with fetchStatus "paused".
    authMe.queryFn = () => {
      onlineManager.setOnline(false);
      return Promise.reject(new Error("auth.me unavailable"));
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 1, retryDelay: 0 } },
    });
    render(<LeadSectionPreviewAuth reportId="r1" />, {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => {
      expect(client.getQueryCache().getAll()[0]?.state).toMatchObject({
        status: "pending",
        fetchStatus: "paused",
        fetchFailureCount: 1,
      });
    });
    expect(screen.getByTestId("weekly-report-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("weekly-report-page")).not.toBeInTheDocument();
  });

  it("opens the lead's own section once auth.me resolves", async () => {
    authMe.queryFn = () => Promise.resolve({ userId: "lead-1" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(<LeadSectionPreviewAuth reportId="r1" />, {
      wrapper: wrapperWith(client),
    });

    expect(await screen.findByTestId("weekly-report-page")).toHaveTextContent(
      "lead-1",
    );
  });
});
