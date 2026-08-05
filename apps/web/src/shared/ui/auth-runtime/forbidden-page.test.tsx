import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForbiddenPage } from "./forbidden-page";

describe("ForbiddenPage", () => {
  it("renders the page-unavailable heading with the reserved-role copy", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    expect(screen.getByText(/page unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/reserved for the head role/i)).toBeInTheDocument();
  });

  it("joins multiple required roles with ' or '", () => {
    render(
      <ForbiddenPage
        requiredRoles={["head", "admin"]}
        homeHref="/head/dashboard"
      />,
    );
    expect(screen.getByText(/head or admin/)).toBeInTheDocument();
  });

  it("links the dashboard button to the caller-resolved home and does not leak a role from the href", () => {
    render(<ForbiddenPage requiredRoles={["head"]} homeHref="/lead/report" />);
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/lead/report");
    expect(document.body).not.toHaveTextContent(/\blead\b/i);
  });

  it("uses a single native <main> landmark without an explicit role attribute", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const allMains = screen.getAllByRole("main");
    expect(allMains).toHaveLength(1);
    expect(allMains[0]).not.toHaveAttribute("role");
  });
});
