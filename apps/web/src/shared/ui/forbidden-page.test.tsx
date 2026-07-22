import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForbiddenPage } from "./forbidden-page";

describe("ForbiddenPage", () => {
  it("renders the page-unavailable heading", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    expect(screen.getByText(/page unavailable/i)).toBeInTheDocument();
  });

  it("renders the required roles label for a single role", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    expect(screen.getByText(/reserved for the head role/i)).toBeInTheDocument();
  });

  it('joins multiple required roles with " or "', () => {
    render(
      <ForbiddenPage
        requiredRoles={["head", "admin"]}
        homeHref="/head/dashboard"
      />,
    );
    expect(screen.getByText(/head or admin/)).toBeInTheDocument();
  });

  it("links the dashboard button to the caller-resolved home (not hardcoded)", () => {
    // The home link uses the caller-provided homeHref (resolved from the
    // visitor's role), never a hardcoded /head/dashboard.
    render(<ForbiddenPage requiredRoles={["head"]} homeHref="/lead/report" />);
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/lead/report");
  });

  it("does not expose a role encoded only in the caller-resolved home href", () => {
    render(<ForbiddenPage requiredRoles={["head"]} homeHref="/lead/report" />);
    expect(screen.getByText(/reserved for the head role/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\blead\b/i);
  });
});

describe("ForbiddenPage — landmark semantics", () => {
  it("main element has implicit semantic role=main via native element, not an explicit role attribute", () => {
    // Native main semantics keep the landmark accessible without a redundant
    // explicit role.
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).not.toHaveAttribute("role");
  });

  it("main element is the only main landmark in the accessibility tree", () => {
    // Exactly one main landmark keeps page navigation unambiguous.
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const allMains = screen.getAllByRole("main");
    expect(allMains).toHaveLength(1);
  });
});
