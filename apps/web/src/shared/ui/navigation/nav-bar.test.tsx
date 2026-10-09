// @vitest-environment jsdom

import type { Role } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render as testingRender,
  screen,
  within,
} from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionState } from "../../lib/auth/session-provider";

const navigationMock = vi.hoisted(() => ({
  pathname: "/lead/report",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useSearchParams: () => navigationMock.searchParams,
}));

const useSessionMock = vi.fn();
vi.mock("../../lib/auth/session-provider", () => ({
  useSession: () => useSessionMock() as SessionState,
}));

import { NavBar } from "./nav-bar";

function render(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return testingRender(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

function setRole(role: Role | null, name = "Test User"): void {
  if (role === null) {
    useSessionMock.mockReturnValue({
      user: null,
      // The loading session has no resolved user or organization identity.
      organization: null,
      isLoading: true,
      isAuthenticated: false,
    });
  } else {
    useSessionMock.mockReturnValue({
      user: {
        id: "u1",
        name,
        email: "t@test.local",
        role,
        reportingGroupName: "Core Development",
      },
      // Realistic org hydration so the nav-bar renders the brand strings
      // consistently with the runtime.
      organization: {
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      },
      isLoading: false,
      isAuthenticated: true,
    });
  }
}

function linksInContainer(container: HTMLElement, href: string) {
  return container.querySelectorAll(`a[href="${CSS.escape(href)}"]`);
}

function expectLinkExists(container: HTMLElement, href: string): void {
  expect(linksInContainer(container, href).length).toBeGreaterThan(0);
}

function expectLinkMissing(container: HTMLElement, href: string): void {
  expect(linksInContainer(container, href)).toHaveLength(0);
}

function setRoute(pathname: string, query = ""): void {
  navigationMock.pathname = pathname;
  navigationMock.searchParams = new URLSearchParams(query);
}

function expectActiveLink(container: HTMLElement, href: string): void {
  expect(
    container.querySelectorAll(
      `a[href="${CSS.escape(href)}"][aria-current="page"]`,
    ).length,
  ).toBeGreaterThan(0);
}

function expectInactiveLink(container: HTMLElement, href: string): void {
  expect(
    container.querySelectorAll(
      `a[href="${CSS.escape(href)}"][aria-current="page"]`,
    ),
  ).toHaveLength(0);
}

describe("NavBar — role-aware visibility", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    setRoute("/lead/report");
  });

  it.each([
    { label: "/admin", hrefs: ["/admin"] as const },
    {
      label: "/head/* (Dashboard, Status)",
      hrefs: ["/head/dashboard", "/head/report"] as const,
    },
    { label: "/lead/report", hrefs: ["/lead/report"] as const },
  ] as const)("viewer does NOT see $label", ({ hrefs }) => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    for (const href of hrefs) {
      expectLinkMissing(container, href);
    }
  });

  it("viewer sees read-only History", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/reports");
  });

  // Viewer-only "Status" entry point that resolves the Status target via
  // /reports/latest.
  it("viewer sees a Status link to /reports/latest", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/reports/latest");
  });

  it("non-viewer roles do not see the Status (/reports/latest) link", () => {
    for (const role of ["lead", "head", "admin"] as const) {
      setRole(role);
      const { container } = render(<NavBar />);
      expectLinkMissing(container, "/reports/latest");
    }
  });

  // The Status entry resolves to a /reports/[id] detail page, so for a viewer
  // that path must light Status, not History.
  it("activates Status (not History) for a viewer on a /reports/[id] detail page", () => {
    setRole("viewer");
    setRoute("/reports/a0000000-0000-4000-8000-000000000001");
    const { container } = render(<NavBar />);
    expectActiveLink(container, "/reports/latest");
    expectInactiveLink(container, "/reports");
  });

  it("activates History (not Status) for a viewer on the bare /reports list", () => {
    setRole("viewer");
    setRoute("/reports");
    const { container } = render(<NavBar />);
    expectActiveLink(container, "/reports");
    expectInactiveLink(container, "/reports/latest");
  });

  // Non-regression: the head keeps History lit on a /reports/[id] detail page
  // (lead-history-summary contract — viewer-only special-casing must not leak).
  it("keeps History active for a head on a /reports/[id] detail page", () => {
    setRole("head");
    setRoute("/reports/a0000000-0000-4000-8000-000000000001");
    const { container } = render(<NavBar />);
    expectActiveLink(container, "/reports");
  });

  it("lead sees Report and History, with Slides folded into the report mode switch", () => {
    setRole("lead");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
    expectLinkExists(container, "/lead/report");
    expectLinkMissing(container, "/lead/slides");
    expectLinkExists(container, "/reports");
  });

  it("lead does NOT see /admin link", () => {
    setRole("lead");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
  });

  it("head does NOT see /admin link", () => {
    setRole("head");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
  });

  it("head sees Dashboard, Status, and History", () => {
    setRole("head");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/head/dashboard");
    expectLinkExists(container, "/head/report");
    expectLinkExists(container, "/reports");
  });

  it("activates Status on addressed /head/report/[reportId] pages", () => {
    setRole("head");
    setRoute("/head/report/a0000000-0000-4000-8000-000000000001");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/head/report");
    expectInactiveLink(container, "/head/dashboard");
  });

  it("admin sees /admin link", () => {
    setRole("admin");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/admin");
    expectLinkMissing(container, "/reports");
  });

  it.each(["head", "admin"] as const)(
    "%s sees the /pdf-exports recovery link",
    (role) => {
      setRole(role);
      const { container } = render(<NavBar />);
      expectLinkExists(container, "/pdf-exports");
    },
  );

  it.each(["lead", "viewer"] as const)(
    "%s does NOT see the /pdf-exports link",
    (role) => {
      setRole(role);
      const { container } = render(<NavBar />);
      expectLinkMissing(container, "/pdf-exports");
    },
  );

  it("renders the user initials in the compact home mark", () => {
    setRole("lead");
    render(<NavBar />);

    const brandLink = screen.getByRole("link", { name: /Test User home$/ });

    expect(within(brandLink).getByText("TU")).toBeVisible();
  });

  it("names the home link with its visible initials first for voice control", () => {
    setRole("lead");
    render(<NavBar />);

    const homeLink = screen.getByRole("link", { name: /Test User home$/ });

    expect(homeLink).toHaveAccessibleName("TU Test User home");
    expect(homeLink).toHaveAttribute("href", "/lead/report");
  });

  // The avatar must derive initials from the structured name parts (surname +
  // given), NOT the name-string fallback. Pin it with a name whose fallback
  // ("ZY") differs from the parts.
  it("derives initials from the structured name parts, not the name fallback", () => {
    useSessionMock.mockReturnValue({
      user: {
        id: "u1",
        name: "Zzz Yyy",
        lastName: "Иванов",
        firstName: "Пётр",
        email: "t@test.local",
        role: "lead",
        reportingGroupName: "Core Development",
      },
      organization: {
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(<NavBar />);
    const brandLink = screen.getByRole("link", { name: /Zzz Yyy home$/ });

    expect(within(brandLink).getByText("ИП")).toBeVisible();
    expect(brandLink).toHaveAccessibleName("ИП Zzz Yyy home");
  });

  it("renders organization identity as restrained text metadata", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const header = container.querySelector<HTMLElement>(
      '[data-testid="nav-bar"]',
    );
    const identity = container.querySelector('[data-testid="nav-identity"]');

    expect(header).not.toBeNull();
    expect(header).not.toHaveAttribute("data-organization-background");
    expect(header?.style.backgroundImage).toBe("");
    expect(identity?.textContent).toContain("Test User");
    expect(identity?.textContent).toContain("PEO");
    expect(identity?.textContent).toContain("Core Development");
    expect(identity?.textContent).toContain("Lead");
    expect(
      container.querySelector('[data-testid="organization-atmosphere"]'),
    ).toBeNull();
  });

  it("keeps the actions in the mobile grid's right column", () => {
    setRole("lead");
    render(<NavBar />);

    expect(screen.getByTestId("nav-bar").firstElementChild).toHaveClass(
      "grid-cols-[minmax(0,1fr)_auto]",
      "sm:grid-cols-[minmax(0,1fr)_auto_auto]",
      "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
    );
  });

  it("shows a wrapping user name and a separate readable role on mobile", () => {
    const fullName = "Alexandria Catherine Montgomery-Wetherington";
    setRole("lead", fullName);
    render(<NavBar />);

    const identity = screen.getByTestId("nav-identity");
    expect(identity).not.toHaveClass("hidden");
    expect(identity).not.toHaveClass("h-8");
    const name = within(identity).getByText(fullName);
    expect(name).not.toHaveClass("truncate");
    expect(name.parentElement).not.toHaveClass("truncate");
    expect(name.parentElement).not.toHaveClass("whitespace-nowrap");
    expect(within(identity).getByText("Lead", { exact: true })).toHaveClass(
      "text-xs",
    );
  });

  it("lets the identity shrink inside its grid column instead of overlapping the nav pills", () => {
    setRole("head", "Alexandria Catherine Montgomery-Wetherington");
    render(<NavBar />);

    const identity = screen.getByTestId("nav-identity");
    const brand = identity.parentElement;
    expect(brand).toHaveClass("min-w-0");
    expect(brand).not.toHaveClass("justify-self-start");
    const name = within(identity).getByText(
      "Alexandria Catherine Montgomery-Wetherington",
    ).parentElement;
    expect(name).toHaveClass("min-w-0");
    expect(name).not.toHaveClass("sm:truncate");
  });

  it("shows the short role below lg and keeps the department line for lg only (R05)", () => {
    setRole("head", "Alexandria Montgomery");
    render(<NavBar />);

    const identity = screen.getByTestId("nav-identity");
    expect(within(identity).getByText("Head", { exact: true })).toHaveClass(
      "lg:hidden",
    );
    expect(identity).toHaveAttribute("title");
    expect(identity.lastElementChild).toHaveClass("hidden", "lg:block");
  });

  it("puts the named menu trigger in the header rail without an extra strip", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const menu = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    expect(menu).toHaveAttribute("title", "Menu");
    expect(menu).toHaveClass("sm:hidden", "w-10");
    expect(menu.parentElement).toBe(
      screen.getByRole("button", { name: "Sign out" }).parentElement,
    );
    expect(menu.closest('[data-testid="nav-bar"]')?.lastElementChild).toBe(
      container.querySelector('[data-testid="nav-accent"]')?.parentElement,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "title",
      "Sign out",
    );
  });

  it("renders exactly one navigation accent", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    expect(
      container.querySelectorAll('[data-testid="nav-accent"]'),
    ).toHaveLength(1);
  });

  it("renders the head role's identity label from the shared ROLE_LABEL map", () => {
    setRole("head");
    const { container } = render(<NavBar />);

    const identity = container.querySelector('[data-testid="nav-identity"]');

    expect(identity?.textContent).toContain("Head");
    expect(identity?.textContent).not.toContain("Group Head");
  });

  it("null session (still loading) renders NO role-gated links", () => {
    setRole(null);
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/lead/report");
  });

  it("renders its internal layout skeleton while the session is loading", () => {
    setRole(null);
    const { container } = render(<NavBar />);

    expect(
      screen.getByRole("link", { name: "Profile loading" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[aria-label="Main navigation"]'),
    ).toBeEmptyDOMElement();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it("hidden links are absent from the DOM (filtered before render — not CSS-hidden)", () => {
    // A hostile viewer reading the rendered HTML must see no enumeration of
    // /admin or /head routes — absence from the DOM is the proof.
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
    expectLinkMissing(container, "/lead/report");
  });

  it("keeps History active on the reports page", () => {
    setRole("head");
    setRoute("/reports", "");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
    expectInactiveLink(container, "/head/dashboard");
  });

  it("does not activate History on report analytics routes", () => {
    setRole("viewer");
    setRoute("/reports/trends");

    const { container } = render(<NavBar />);

    expectInactiveLink(container, "/reports");
  });

  it("gives /reports/trends its own nav destination for every role", () => {
    for (const role of ["lead", "head", "admin", "viewer"] as const) {
      setRole(role);
      setRoute("/reports/trends");

      const { container, unmount } = render(<NavBar />);

      expectLinkExists(container, "/reports/trends");
      expectActiveLink(container, "/reports/trends");
      unmount();
    }
  });
});
