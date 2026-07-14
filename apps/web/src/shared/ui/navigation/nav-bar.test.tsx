/**
 * @vitest-environment jsdom
 */

import type { Role } from "@customreport/shared";
import { render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionState } from "../../../lib/session-provider";

const navigationMock = vi.hoisted(() => ({
  pathname: "/lead/report",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useSearchParams: () => navigationMock.searchParams,
}));

const useSessionMock = vi.fn();
vi.mock("../../../lib/session-provider", () => ({
  useSession: () => useSessionMock() as SessionState,
}));

// NavBar reads the active period via tRPC for the right-rail badge. Tests
// don't exercise that surface — stub the proxy to a minimal object that
// satisfies `trpc.weeklyReport.get.queryOptions(...)` calls.
vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    weeklyReport: {
      get: {
        queryOptions: () => ({
          queryKey: ["weeklyReport", "get"],
          // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async queryFn contract expected by react-query (no awaitable work in the stub)
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
      // nav-bar consumes `organization.shortName`. For the
      // "unauthenticated" case there is no session and thus no org — the
      // consumer falls back to the seeded 'PEO' default.
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

  it("viewer does NOT see /lead/report", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/lead/report");
  });

  it("viewer sees read-only History", () => {
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/reports");
  });

  // viewer-live-status (task 4.1): viewer-only "Status" entry point that resolves
  // the Status target via /reports/latest.
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

  // viewer-live-status: the Status entry resolves to a /reports/[id] detail
  // page, so for a viewer that path must light Status, not History (the
  // reported bug: clicking Status highlighted History).
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

  it("head sees three tabs: Dashboard, Status, History (no Slides — T-F4-3)", () => {
    setRole("head");
    const { container } = render(<NavBar />);
    expectLinkExists(container, "/head/dashboard");
    expectLinkExists(container, "/head/report");
    // remove-dead-history-tab-param: head History points to bare /reports.
    expectLinkExists(container, "/reports");
    expectLinkMissing(container, "/head/history");
    expectLinkMissing(container, "/head/slides");
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

  it("renders the parked Theme control with Coming Soon in metadata", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const themeControl = container.querySelector(
      '[data-testid="theme-coming-soon"]',
    );

    expect(themeControl).not.toBeNull();
    // Icon-only: visible text was removed in favour of the aria-label + amber
    // ComingSoonBadge tooltip (#2 navbar fix). The native title="Coming Soon"
    // was dropped so it no longer stacks a second tooltip over the badge.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- queried node + textContent are nullable in the DOM assertion
    expect(themeControl?.textContent?.trim()).toBe("");
    expect(themeControl).toHaveAttribute(
      "aria-label",
      "Theme selection is coming soon",
    );
    expect(themeControl).not.toHaveAttribute("title");
    expect(themeControl).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the parked Language control with Coming Soon metadata", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const languageControl = container.querySelector(
      '[data-testid="language-coming-soon"]',
    );

    expect(languageControl).not.toBeNull();
    // Icon-only: visible text was removed in favour of the aria-label + amber
    // ComingSoonBadge tooltip (#2 navbar fix). The native title="Coming Soon"
    // was dropped so it no longer stacks a second tooltip over the badge.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- queried node + textContent are nullable in the DOM assertion
    expect(languageControl?.textContent?.trim()).toBe("");
    expect(languageControl).toHaveAttribute(
      "aria-label",
      "Language selection is coming soon",
    );
    expect(languageControl).not.toHaveAttribute("title");
    expect(languageControl).toHaveAttribute("aria-disabled", "true");
  });

  it("renders Theme before Language in the right rail", () => {
    setRole("lead");
    const { container } = render(<NavBar />);

    const comingSoonControls = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[data-testid$="coming-soon"]',
      ),
    ).map((element) => element.dataset.testid);

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

  // add-structured-user-name (review finding P3): the avatar must derive initials
  // from the structured ФИО parts (surname + given), NOT the name-string
  // fallback. Pin it with a name whose fallback ("ZY") differs from the parts.
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

    const { container } = render(<NavBar />);
    const brandLink = container.querySelector('a[aria-label="Zzz Yyy home"]');

    expect(brandLink?.textContent).toBe("ИП");
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

  it("hidden links are absent from the DOM (filtered before render — not CSS-hidden)", () => {
    // T0 invariant from the plan: queryByText returning null is the proof.
    // Critical: a hostile viewer who reads the rendered HTML must see no
    // enumeration of /admin or /head routes.
    setRole("viewer");
    const { container } = render(<NavBar />);
    expectLinkMissing(container, "/admin");
    expectLinkMissing(container, "/head/dashboard");
    expectLinkMissing(container, "/head/report");
    expectLinkMissing(container, "/lead/report");
  });

  it("activates History on a stray /reports?tab=drafts URL (back-compat)", () => {
    setRole("lead");
    setRoute("/reports", "tab=drafts");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
  });

  it("activates head History on a stray /reports?tab=published URL", () => {
    setRole("head");
    setRoute("/reports", "tab=published");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
    expectInactiveLink(container, "/head/dashboard");
  });

  it("keeps the lead History link active on a stray tab URL", () => {
    setRole("lead");
    setRoute("/reports", "tab=published");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
  });

  it("keeps head History active on /reports with NO tab param (§4.3)", () => {
    // The archive toggle no longer writes the URL, so /reports can be visited
    // with no tab param at all. History must stay highlighted regardless —
    // proving the active state is decoupled from the tab/archive query.
    setRole("head");
    setRoute("/reports", "");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
    expectInactiveLink(container, "/head/dashboard");
  });

  it("keeps lead History active on /reports with NO tab param (§4.3)", () => {
    setRole("lead");
    setRoute("/reports", "");

    const { container } = render(<NavBar />);

    expectActiveLink(container, "/reports");
  });

  it("does not activate History on report analytics routes", () => {
    setRole("viewer");
    setRoute("/reports/trends");

    const { container } = render(<NavBar />);

    expectInactiveLink(container, "/reports");
  });
});
