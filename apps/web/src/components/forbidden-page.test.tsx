import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForbiddenPage } from "./forbidden-page";

describe("ForbiddenPage (AUTH-07)", () => {
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

  it("does NOT leak the user actual role into the DOM (T4)", () => {
    // The component contract is that requiredRoles is the ONLY role-shaped
    // input — no actualRole prop exists, so there is no surface through
    // which the user's role can reach the DOM. homeHref is a pre-resolved
    // path string, not a role. Spot-check by ensuring no disallowed string
    // ('viewer' / 'lead') appears when only 'head' is required.
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\blead\b/i)).not.toBeInTheDocument();
  });
});

// VA-0a/VA-0b: verify-a11y-recommended-flip regression coverage
// Change: removed redundant role="main" from <main> (native element is sufficient)
describe("ForbiddenPage — a11y regression (VA-0a/VA-0b)", () => {
  it("main element has implicit semantic role=main via native element, not an explicit role attribute", () => {
    // getByRole('main') resolves via the native <main> element's implicit ARIA
    // role. The explicit role="main" attribute was removed as redundant; this
    // test guards that it was not re-added — having it would mean the element
    // carries both implicit and explicit role, which is the pre-fix state.
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).not.toHaveAttribute("role");
  });

  it("main element is the only main landmark in the accessibility tree", () => {
    // Exactly one main landmark must exist; a second would indicate a
    // structural regression (e.g. a wrapper also carrying role="main").
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const allMains = screen.getAllByRole("main");
    expect(allMains).toHaveLength(1);
  });

  it("main element layout classes are intact (snapshot)", () => {
    // Guards that the role= removal did not accidentally mutate the className
    // string. Snapshot is taken on the <main> element itself to avoid coupling
    // to shadcn/ui Card internals.
    render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    const main = screen.getByRole("main");
    expect(main).toMatchSnapshot();
  });

  it("Card child of main is rendered with max-w-md class intact (snapshot)", () => {
    // Guards that the role= change did not accidentally strip the Card wrapper
    // or its sizing class. Snapshot scoped to the direct Card child of <main>.
    const { container } = render(
      <ForbiddenPage requiredRoles={["head"]} homeHref="/head/dashboard" />,
    );
    // The Card is the first direct child of <main>.
    const main = container.querySelector("main");
    expect(main?.firstElementChild).toMatchSnapshot();
  });
});
