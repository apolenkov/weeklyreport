/**
 * Regression for fix-sweep-ui-findings: /lead/report/[reportId]/preview threw a
 * hydration mismatch because the server streamed the page's Suspense fallback
 * (WeeklyReportSkeleton) while the client's first render showed a bespoke inline
 * skeleton from this component's loading branch. The loading branch must now
 * render the same WeeklyReportSkeleton so SSR and client agree.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Keep auth.me perpetually pending so the loading branch is what renders.
vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({
          queryKey: ["auth", "me"],
          queryFn: () => new Promise(() => undefined),
        }),
      },
    },
  }),
}));

import { LeadSectionPreviewAuth } from "./lead-section-preview-auth";

function Wrapper({ children }: { readonly children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("LeadSectionPreviewAuth", () => {
  it("renders the shared WeeklyReportSkeleton while auth.me is loading", () => {
    render(<LeadSectionPreviewAuth reportId="r1" />, { wrapper: Wrapper });

    expect(screen.getByTestId("weekly-report-skeleton")).toBeInTheDocument();
  });
});
