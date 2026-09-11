// @vitest-environment jsdom

import { sessionRoleSchema } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "./../test-utils/query-state";

const useQueryMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (opts: { queryKey?: readonly unknown[] }) =>
      useQueryMock(opts) as ReturnType<typeof actual.useQuery>,
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock() as URLSearchParams,
}));

vi.mock("../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    auth: { me: { queryOptions: () => ({ queryKey: ["auth.me"] }) } },
    org: {
      getPublic: { queryOptions: () => ({ queryKey: ["org.getPublic"] }) },
    },
  }),
}));

vi.mock("../features/landing/ui/pulse-background", () => ({
  PulseBackground: () => null,
}));
vi.mock("../features/landing/ui/pulse-mark", () => ({
  PulseMark: () => null,
}));
vi.mock("../features/landing/ui/tagline-cycler", () => ({
  TaglineCycler: () => null,
}));

const STUB_ORG = {
  shortName: "PEO",
  fullName: "Product Engineering & Operations",
};

beforeEach(() => {
  // AUTH_STUB is read at module-eval time — set before importing the module.
  vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "false");

  useQueryMock.mockImplementation((opts: { queryKey?: readonly unknown[] }) => {
    const key = opts.queryKey?.at(0);
    if (key === "auth.me") return makeQueryState({ data: null });
    if (key === "org.getPublic") return makeQueryState({ data: STUB_ORG });
    return makeQueryState({ data: null });
  });

  useSearchParamsMock.mockReturnValue(new URLSearchParams());
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  useQueryMock.mockReset();
  useSearchParamsMock.mockReset();
});

async function loadLoginPageClient() {
  const mod = await import("./login-page.client");
  return mod.LoginPageClient;
}

describe("Primary CTA accessibility", () => {
  it.each([
    [
      "next=%2Freports%2Freport-1",
      "/auth/saml/login?next=%2Freports%2Freport-1",
    ],
    [
      "next=%2Freports%2Freport-1&next=%2Freports%2Freport-2",
      "/auth/saml/login",
    ],
  ])("uses only a scalar next destination: %s", async (query, href) => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams(query));
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      href,
    );
  });

  it("SVG inside primary CTA link has aria-hidden='true'", async () => {
    const LoginPageClient = await loadLoginPageClient();
    const { container } = render(<LoginPageClient initialOrg={STUB_ORG} />);

    // The SVG is aria-hidden so RTL role queries won't find it; locate via
    // the data-testid anchor then query the SVG from the render container.
    const svgEl = container.querySelector("[data-testid='primary-cta'] svg");
    expect(svgEl).not.toBeNull();
    expect(svgEl).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the concise visible sign-in label as its accessible name", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const cta = screen.getByRole("link", {
      name: "Sign in",
    });
    expect(cta).toHaveAccessibleName("Sign in");
    expect(cta).toHaveTextContent("Sign in");
  });
});

describe("Dev-mode role picker (AUTH_STUB=true, no stored hint)", () => {
  it("shows the direct role picker instead of collapsing the block", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "true");
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    // After the localStorage check resolves (no hint stored in jsdom),
    // the box must offer the role picker and remain available for role choice.
    const picker = await screen.findByTestId("role-picker");
    expect(picker).toBeInTheDocument();
    for (const role of sessionRoleSchema.options) {
      expect(
        screen.getByTestId(`last-role-option-${role}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByTestId("last-role-hint-skeleton"),
    ).not.toBeInTheDocument();
  });
});

describe("Login page — session query failure", () => {
  it("surfaces the failure instead of rendering the ordinary signed-out state", async () => {
    useQueryMock.mockImplementation(
      (opts: { queryKey?: readonly unknown[] }) => {
        const key = opts.queryKey?.[0];
        if (key === "auth.me")
          return makeQueryState({ data: null, error: new Error("boom") });
        if (key === "org.getPublic") return makeQueryState({ data: STUB_ORG });
        return makeQueryState({ data: null });
      },
    );

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    expect(screen.getByTestId("landing-session-error")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });
});
