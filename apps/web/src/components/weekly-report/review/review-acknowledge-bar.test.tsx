/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewAcknowledgeBar } from "./review-acknowledge-bar";

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      acknowledgements: {
        queryOptions: (input: { reportId: string; groupId: string }) => ({
          queryKey: ["review.acknowledgements", input],
          queryFn: () => [],
        }),
      },
      acknowledge: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: () => Promise.resolve({}),
        }),
      },
    },
  }),
}));

describe("ReviewAcknowledgeBar — compact touch floor (responsive-compact-layout)", () => {
  it("the Acknowledge button floors at the touch target below md", () => {
    // jsdom cannot evaluate media queries; the class assertion is the teeth.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReviewAcknowledgeBar
          reportId="11111111-1111-4111-8111-111111111111"
          groups={[{ groupId: "44444444-4444-4444-8444-444444444444" }]}
          currentUserId="22222222-2222-4222-8222-222222222222"
          isHeadOrAdmin={false}
        />
      </QueryClientProvider>,
    );

    const acknowledge = screen.getByRole("button", { name: "Acknowledge" });
    expect(acknowledge.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});
