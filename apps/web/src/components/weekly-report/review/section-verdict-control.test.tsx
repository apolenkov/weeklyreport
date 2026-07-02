/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { SectionVerdictControl } from "./section-verdict-control";

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      verdict: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: () =>
            Promise.resolve({ unsubmitted: false, verdict: "approved" }),
        }),
      },
    },
  }),
}));

function renderWithClient(ui: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

function renderControl(canReview: boolean) {
  return renderWithClient(
    <SectionVerdictControl
      reportSectionId="11111111-1111-4111-8111-111111111111"
      version={1}
      reviews={[]}
      canReview={canReview}
      onMutated={vi.fn()}
    />,
  );
}

describe("SectionVerdictControl — verdict buttons", () => {
  it("renders Approve / Request changes only for a designated reviewer", () => {
    renderControl(false);
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("both verdict buttons floor at the touch target below md (responsive-compact-layout)", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // The pills keep their desktop density (py-0.5, ~21px) and only the hit
    // area grows on the phone-floored review surface.
    renderControl(true);

    const approve = screen.getByRole("button", { name: "Approve" });
    const requestChanges = screen.getByRole("button", {
      name: "Request changes",
    });
    for (const button of [approve, requestChanges]) {
      expect(button.className).toContain(
        "max-md:min-h-[var(--touch-target-min)]",
      );
    }
  });
});
