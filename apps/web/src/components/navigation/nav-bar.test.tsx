/**
 * @vitest-environment jsdom
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Role } from "@customreport/shared";

const navigationMock = vi.hoisted(() => ({
  pathname: "/lead/report",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useSearchParams: () => navigationMock.searchParams,
}));

const useSessionMock = vi.fn();
vi.mock("../../lib/session-provider", () => ({
  useSession: () => useSessionMock(),
}));

// Phase 33-04: NavBar now reads the active period via tRPC for the right-rail
// badge. Tests don't exercise that surface — stub the proxy to a minimal
// object that satisfies `trpc.weeklyReport.get.queryOptions(...)` calls.
vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: {
        queryOptions: () => ({
          queryKey: ["weeklyReport", "get"],
          queryFn: async () => null,
          enabled: false,
        }),
      },
    },
  }),
}));

// useQuery without a real QueryClientProvider would crash; stub it for these
// role-visibility tests since we don't care about the period badge here.
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

import { NavBar } from "./nav-bar";

function setRole(role: Role | null): void {
  if (role === null) {
    useSessionMock.mockReturnValue({
      user: null,
      // UFB-047 / Phase 48-A: nav-bar consumes `organization.shortName`.
      // For the "unauthenticated" case there is no session and thus no
      // org — the consumer falls back to the seeded 'PEO' default.
      organization: null,
      isLoading: true,
      isAuthenticated: false,
    });
  } else {
    useSessionMock.mockReturnValue({
      user: {
        id: "u1",
        name: "Test User",
        email: "t@test.local",
        role,
        reportingGroupName: "Core Development",
      },
      // UFB-047 / Phase 48-A: realistic org hydration so the nav-bar
      // renders the brand strings consistently with the runtime.
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
  return container.querySelectorAll(`a[href="${href}"]`);
}

function expectLinkExists(container: HTMLElement, href: string): void {
  expect(linksInContainer(container, href).length).toBeGreaterThan(0);
}

function expectLinkMissing(container: HTMLElement, href: string): void {
  expect(linksInContainer(container, href).length).toBe(0);
}

function setRoute(pathname: string, query = ""): void {
  navigationMock.pathname = pathname;
  navigationMock.searchParams = new URLSearchParams(query);
}

function expectActiveLink(container: HTMLElement, href: string): void {
  expect(
    container.querySelectorAll(`a[href="${href}"][aria-current="page"]`).length,
  ).toBeGreaterThan(0);
}

function expectInactiveLink(container: HTMLElement, href: string): void {
  expect(
    container.querySelectorAll(`a[href="${href}"][aria-current="page"]`).length,
  ).toBe(0);
}

describe("NavBar — AUTH-06 role-aware visibility (Phase 29-06)", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    setRoute("/lead/report");
  });

  it("viewer does NOT see /admin link in the DOM", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
  });

  it("viewer does NOT see /head/* links (Dashboard, Status)", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
  });

  it("viewer does NOT see /lead/* links (Report, History)", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/lead/report");
    expectLinkMissing(container, "/reports?tab=drafts");
  });

  it("viewer sees read-only History", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/reports?tab=published");
  });

  it("lead sees Report and History, with Slides folded into the report mode switch", () => {
    setRole("lead");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
    expectLinkExists(container, "/lead/report");
    expectLinkMissing(container, "/lead/slides");
    expectLinkExists(container, "/reports?tab=drafts");
    expectLinkMissing(container, "/reports?tab=published");
  });

  it("lead does NOT see /admin link", () => {
    setRole("lead");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
  });

  it("head does NOT see /admin link (UFB-038)", () => {
    setRole("head");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
  });

  it("head sees three tabs: Dashboard, Status, History (no Slides — T-F4-3)", () => {
    setRole("head");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/head/dashboard");
    expectLinkExists(container, "/head/report");
    expectLinkExists(container, "/head/history");
    expectLinkMissing(container, "/head/slides");
    expectLinkMissing(container, "/reports?tab=drafts");
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
    expectLinkMissing(container, "/reports?tab=drafts");
    expectLinkMissing(container, "/reports?tab=published");
  });

  it("renders the parked Theme control with Coming Soon in metadata", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const themeControl = container.querySelector(
      '[data-testid="theme-coming-soon"]',
    );

    expect(themeControl).not.toBeNull();
    expect(themeControl?.textContent).toMatch(/Theme/i);
    expect(themeControl?.textContent).not.toMatch(/Soon/i);
    expect(themeControl).toHaveAttribute(
      "aria-label",
      "Theme selection is coming soon",
    );
    expect(themeControl).toHaveAttribute("title", "Coming Soon");
    expect(themeControl).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the parked Language control with Coming Soon metadata", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const languageControl = container.querySelector(
      '[data-testid="language-coming-soon"]',
    );

    expect(languageControl).not.toBeNull();
    expect(languageControl?.textContent).toMatch(/Language/i);
    expect(languageControl?.textContent).not.toMatch(/Soon/i);
    expect(languageControl).toHaveAttribute(
      "aria-label",
      "Language selection is coming soon",
    );
    expect(languageControl).toHaveAttribute("title", "Coming Soon");
    expect(languageControl).toHaveAttribute("aria-disabled", "true");
  });

  it("renders Theme before Language in the right rail", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const comingSoonControls = Array.from(
      container.querySelectorAll('button[data-testid$="coming-soon"]'),
    ).map((element) => element.getAttribute("data-testid"));

    expect(comingSoonControls).toEqual([
      "theme-coming-soon",
      "language-coming-soon",
    ]);
  });

  it("renders the user initials in the compact home mark", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const brandLink = container.querySelector('a[aria-label="Test User home"]');

    expect(brandLink).not.toBeNull();
    expect(brandLink?.textContent).toBe("TU");
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

  it("null session (still loading) renders NO role-gated links", () => {
    setRole(null);
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/lead/report");
  });

  it("hidden links are absent from the DOM (filtered before render — not CSS-hidden)", () => {
    // T0 invariant from the plan: queryByText returning null is the proof.
    // Critical for AUTH-06 — a hostile viewer who reads the rendered HTML must
    // see no enumeration of /admin or /head routes.
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
    expectLinkMissing(container, "/lead/report");
  });

  it("activates only History on /reports?tab=drafts", () => {
    setRole("lead");
    setRoute("/reports", "tab=drafts");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports?tab=drafts");
    expectLinkMissing(container, "/reports?tab=published");
  });

  it("activates head History on /head/history", () => {
    setRole("head");
    setRoute("/head/history");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/head/history");
    expectInactiveLink(container, "/head/dashboard");
  });

  it("keeps the lead History link active on the Archive tab", () => {
    setRole("lead");
    setRoute("/reports", "tab=published");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports?tab=drafts");
    expectLinkMissing(container, "/reports?tab=published");
  });

  it("does not activate History on report analytics routes", () => {
    setRole("viewer");
    setRoute("/reports/trends");

    const { container } = render(<NavBar />);

    expectInactiveLink(container, "/reports?tab=published");
  });
});
