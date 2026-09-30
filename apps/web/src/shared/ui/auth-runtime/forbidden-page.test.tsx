import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForbiddenPage } from "./forbidden-page";

describe("ForbiddenPage", () => {
  it("renders the page-unavailable heading with a plain required-role reason", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /page unavailable for your role/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/requires the head role/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you do not have access to this page/i),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/head back|dashboard/i);
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

  it.each([
    "/lead/report",
    "/reports/latest",
    "/head/dashboard",
    "/admin",
    "/",
  ])("links to the caller-resolved home %s", (homeHref) => {
    render(<ForbiddenPage requiredRoles={["head"]} homeHref={homeHref} />);
    const link = screen.getByRole("link", { name: "Go to my home page" });
    expect(link).toHaveAttribute("href", homeHref);
    expect(document.body).not.toHaveTextContent(/\blead\b|\bviewer\b/i);
  });

  it("uses a single native <main> landmark without an explicit role attribute", () => {
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const allMains = screen.getAllByRole("main");
    expect(allMains).toHaveLength(1);
    expect(allMains[0]).not.toHaveAttribute("role");
    expect(allMains[0]).toHaveAttribute("id", "main-content");
    expect(allMains[0]).toHaveAttribute("tabindex", "-1");
  });
});
