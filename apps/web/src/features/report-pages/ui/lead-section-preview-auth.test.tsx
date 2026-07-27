// Loading branch must reuse WeeklyReportSkeleton so SSR Suspense fallback matches.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Keep auth.me perpetually pending so the loading branch is what renders.
// `vi.hoisted` because the mock factory is hoisted above this module's body.
const { neverSettles } = vi.hoisted(() => ({
  neverSettles: (): Promise<never> => new Promise<never>(() => undefined),
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({
          queryKey: ["auth", "me"],
          queryFn: neverSettles,
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
