// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadForm } from "./lead-form";
import { buildLeadLoadHarness } from "./lead-form-load-test-harness";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

describe("LeadForm native form submit (TASK-503.64 C4872)", () => {
  it("cancels a native submit so Enter in a field cannot reload the page and drop the draft", async () => {
    const { Wrapper } = buildLeadLoadHarness();
    render(<LeadForm />, { wrapper: Wrapper });

    const form = await screen.findByTestId("lead-report-form");
    // fireEvent returns false when a handler called preventDefault().
    expect(fireEvent.submit(form)).toBe(false);
  });
});

// C4872 support: the report is one big <form>, so every action inside it must
// declare `type="button"`; an implicit submit button would let Enter in a field
// activate it instead of only cancelling the native submit.
describe.each(["edit", "slides"] as const)(
  "report form buttons (%s)",
  (mode) => {
    it("never renders a button without an explicit type", async () => {
      const { Wrapper } = buildLeadLoadHarness();
      render(<LeadForm mode={mode} />, { wrapper: Wrapper });

      const form = await screen.findByTestId("lead-report-form");
      const buttons = form.querySelectorAll("button");

      expect(buttons).not.toHaveLength(0);
      expect(form.querySelectorAll("button:not([type='button'])")).toHaveLength(
        0,
      );
    });
  },
);
