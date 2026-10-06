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

vi.mock("../shared/lib/trpc/trpc-context", async () => {
  const { createMockTRPC } = await vi.importActual<
    typeof import("../test-utils/mock-trpc")
  >("../test-utils/mock-trpc");
  const { proxy } = createMockTRPC([
    { path: ["auth", "me"], query: null },
    { path: ["org", "getPublic"], query: null },
  ]);
  return { useTRPC: () => proxy };
});

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
  shortName: "Demo",
  fullName: "Example Software Department",
};

beforeEach(() => {
  // AUTH_STUB is read at module-eval time — set before importing the module.
  vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "false");

  useQueryMock.mockImplementation((opts: { queryKey?: readonly unknown[] }) => {
    const path = opts.queryKey?.[0];
    if (Array.isArray(path) && path[0] === "auth" && path[1] === "me") {
      return makeQueryState({ data: null });
    }
    if (Array.isArray(path) && path[0] === "org" && path[1] === "getPublic") {
      return makeQueryState({ data: STUB_ORG });
    }
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

describe("Landing identity", () => {
  it("keeps organization metadata opaque on the desktop green panel", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    expect(
      screen.getByText("Demo · Example Software Department"),
    ).toHaveClass("text-[var(--color-primary-foreground)]");
  });
});

describe("Sign-in column", () => {
  it("titles the column with a level-two heading below the single h1", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Sign in",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("drops the footer organization name from lg up because the hero names it", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const footerName = screen.getByText("Example Software Department");
    expect(footerName).toHaveClass("lg:hidden");
    // Without a build version nothing is left to show, so the divider goes too.
    expect(footerName.closest("div")).toHaveClass("lg:hidden");
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
    expect(screen.getByText("Sign in as:")).toBeInTheDocument();
    const roleList = screen.getByRole("list", { name: "Sign in as" });
    expect(roleList).toBeInTheDocument();
    for (const option of roleList.querySelectorAll("a")) {
      expect(option).toHaveClass("min-h-11", "text-sm");
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
        const path = opts.queryKey?.[0];
        if (Array.isArray(path) && path[0] === "auth" && path[1] === "me") {
          return makeQueryState({ data: null, error: new Error("boom") });
        }
        if (
          Array.isArray(path) &&
          path[0] === "org" &&
          path[1] === "getPublic"
        ) {
          return makeQueryState({ data: STUB_ORG });
        }
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
