// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadFormSkeleton } from "./lead-form-skeleton";

describe("LeadFormSkeleton — a11y contract", () => {
  it("exposes the loading status region with busy state and label", () => {
    render(<LeadFormSkeleton />);

    const status = screen.getByRole("status", { name: "Loading report form" });
    expect(status).toHaveAttribute("aria-busy", "true");
  });
});
