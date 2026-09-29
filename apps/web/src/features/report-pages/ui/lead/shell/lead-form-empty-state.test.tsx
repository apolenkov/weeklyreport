import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadFormEmptyState } from "./lead-form-empty-state";

describe("LeadFormEmptyState", () => {
  it("names the page with an h1 and links to the report history", () => {
    render(
      <LeadFormEmptyState titleId="empty-title" title="No active period">
        <p>Nothing to fill yet.</p>
      </LeadFormEmptyState>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "No active period" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View report history/ }),
    ).toHaveAttribute("href", "/reports");
  });
});
