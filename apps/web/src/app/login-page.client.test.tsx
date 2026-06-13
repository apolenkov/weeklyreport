/**
 * @vitest-environment jsdom
 */

/**
 * VA-0a/VA-0b: verify-a11y regression catalog — login-page.client.tsx
 *
 * Catalog section: apps/web/src/app/login-page.client.tsx
 * Change: aria-hidden="true" added to the decorative login-icon SVG in the
 * primary CTA link to prevent redundant screen-reader announcement.
 *
 * In-scope rows (unit-rtl high + snapshot):
 *   1. Primary CTA SVG has aria-hidden="true" attribute
 *   2. SVG does not contribute an accessible name to the parent link
 *   3. Snapshot: primary CTA link DOM structure (SVG + text node)
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock() as unknown,
}));

vi.mock("../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: { me: { queryOptions: () => ({ queryKey: ["auth.me"] }) } },
    org: {
      getPublic: { queryOptions: () => ({ queryKey: ["org.getPublic"] }) },
    },
  }),
}));

vi.mock("../components/landing/pulse-background", () => ({
  PulseBackground: () => null,
}));
vi.mock("../components/landing/pulse-mark", () => ({
  PulseMark: () => null,
}));
vi.mock("../components/landing/tagline-cycler", () => ({
  TaglineCycler: () => null,
}));

const STUB_ORG = {
  shortName: "Demo",
  fullName: "Example Software Department",
};

beforeEach(() => {
  // AUTH_STUB is read at module-eval time — set before importing the module.
  process.env.NEXT_PUBLIC_AUTH_STUB = "false";

  useQueryMock.mockImplementation((opts: { queryKey?: readonly unknown[] }) => {
    const key = opts.queryKey?.at(0);
    if (key === "auth.me") return { data: null, isLoading: false };
    if (key === "org.getPublic") return { data: STUB_ORG, isLoading: false };
    return { data: null, isLoading: false };
  });

  useSearchParamsMock.mockReturnValue({
    get: (_k: string) => null,
  });
});

afterEach(() => {
  vi.resetModules();
  useQueryMock.mockReset();
  useSearchParamsMock.mockReset();
});

async function loadLoginPageClient() {
  const mod = await import("./login-page.client");
  return mod.LoginPageClient;
}

describe("VA-0a: Primary CTA SVG aria-hidden (login-page.client)", () => {
  it("SVG inside primary CTA link has aria-hidden='true'", async () => {
    const LoginPageClient = await loadLoginPageClient();
    const { container } = render(<LoginPageClient initialOrg={STUB_ORG} />);

    // The SVG is aria-hidden so RTL role queries won't find it; locate via
    // the data-testid anchor then query the SVG from the render container.
    const svgEl = container.querySelector("[data-testid='primary-cta'] svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl).toHaveAttribute("aria-hidden", "true");
  });

  it("SVG does not contribute to the accessible name of the primary CTA link", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    // In production (AUTH_STUB=false) the aria-label is "Sign in with corporate SSO".
    // If the SVG were NOT aria-hidden, ATF would pick up its inner text/paths
    // and the label would differ. With aria-hidden the resolved accessible name
    // comes solely from the explicit aria-label on the <a> element.
    const cta = screen.getByRole("link", {
      name: "Sign in with corporate SSO",
    });
    expect(cta).toBeInTheDocument();
  });
});

describe("Dev-mode role picker (AUTH_STUB=true, no stored hint)", () => {
  it("shows the direct role picker instead of collapsing the block", async () => {
    process.env.NEXT_PUBLIC_AUTH_STUB = "true";
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    // After the localStorage check resolves (no hint stored in jsdom),
    // the box must offer the role picker — not vanish (the old collapse
    // read as a layout jump and left no way to pick a role).
    const picker = await screen.findByTestId("role-picker");
    expect(picker).toBeInTheDocument();
    for (const role of ["lead", "head", "admin", "viewer"] as const) {
      expect(
        screen.getByTestId(`last-role-option-${role}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByTestId("last-role-hint-skeleton"),
    ).not.toBeInTheDocument();
  });
});

describe("VA-0b: Primary CTA link snapshot (login-page.client)", () => {
  it("matches snapshot — SVG aria-hidden + text node coexist in CTA link", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const cta = screen.getByTestId("primary-cta");
    expect(cta).toMatchSnapshot();
  });
});
