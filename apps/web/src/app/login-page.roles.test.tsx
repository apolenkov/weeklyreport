// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LAST_ROLE_STORAGE_KEY } from "../shared/lib/auth/last-role";

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

// Lightweight stubs for landing-only visuals — keep tests focused on
// the last-role hint, not the hero rendering.
vi.mock("../features/landing/ui/pulse-background", () => ({
  PulseBackground: () => null,
}));
vi.mock("../features/landing/ui/pulse-mark", () => ({
  PulseMark: () => null,
}));
vi.mock("../features/landing/ui/tagline-cycler", () => ({
  TaglineCycler: () => null,
}));

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
}

const STUB_ORG = {
  shortName: "Demo",
  fullName: "Example Software Department",
};

const HEAD_ROLE = {
  role: "head",
  email: "head@customreport.local",
  name: "Антон К.",
} as const;

// One holder for the whole file; beforeEach empties it instead of rebinding.
const storage = makeMemoryStorage();

beforeEach(() => {
  // AUTH_STUB is gated on `process.env.NEXT_PUBLIC_AUTH_STUB === 'true'`
  // at the module top-level — set BEFORE importing the client module.
  process.env.NEXT_PUBLIC_AUTH_STUB = "true";

  storage.clear();
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  // Default: unauthenticated landing.
  useQueryMock.mockImplementation((opts: { queryKey?: readonly unknown[] }) => {
    const key = opts.queryKey?.at(0);
    if (key === "auth.me") return { data: null, isLoading: false };
    if (key === "org.getPublic") return { data: STUB_ORG, isLoading: false };
    return { data: null, isLoading: false };
  });

  useSearchParamsMock.mockReturnValue(new URLSearchParams());
});

afterEach(() => {
  vi.resetModules();
  vi.mocked(useQueryMock).mockReset();
  vi.mocked(useSearchParamsMock).mockReset();
});

async function loadLoginPageClient() {
  const mod = await import("./login-page.client");
  return mod.LoginPageClient;
}

function storeLastRole(record: object) {
  storage.setItem(LAST_ROLE_STORAGE_KEY, JSON.stringify(record));
}

// AUTH_STUB last-role section holds min-height via skeleton to prevent CLS.
describe("Landing page — CLS skeleton", () => {
  it("renders an aria-hidden last-role skeleton before hydration", async () => {
    const LoginPageClient = await loadLoginPageClient();
    const markup = renderToStaticMarkup(
      <LoginPageClient initialOrg={STUB_ORG} />,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;

    const skeleton = container.querySelector(
      "[data-testid='last-role-hint-skeleton']",
    );
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render last-role-hint section in production mode (no AUTH_STUB)", async () => {
    // In production AUTH_STUB=false; the entire hint block is never rendered,
    // so there is nothing to cause CLS on the real login page.
    process.env.NEXT_PUBLIC_AUTH_STUB = "false";

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    await waitFor(() => {
      expect(screen.getByTestId("primary-cta")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("last-role-hint-skeleton")).toBeNull();
    expect(screen.queryByTestId("last-role-hint")).toBeNull();
  });
});

describe("Landing page — a11y heading (page-has-heading-one)", () => {
  it("renders exactly one level-one heading naming the product", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const headings = await screen.findAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Weekly Report");
  });
});

describe("Landing page — last-role hint", () => {
  it("does not render the hint when no record is stored", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);
    await waitFor(() => {
      expect(screen.getByTestId("primary-cta")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("last-role-hint")).toBeNull();
  });

  it("renders the hint with name + role label after a record is stored", async () => {
    storeLastRole(HEAD_ROLE);

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const hint = await screen.findByTestId("last-role-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("Антон К.");
    expect(hint).toHaveTextContent("Head");
  });

  it("points the primary CTA at the persisted role dev-login URL", async () => {
    storeLastRole({
      role: "lead",
      email: "lead1@customreport.local",
      name: "Lead 1",
    });

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const cta = await screen.findByTestId("primary-cta");
    await waitFor(() => {
      expect(cta.getAttribute("href")).toContain("role=lead");
    });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("email=lead1%40customreport.local");
    expect(href).toContain("redirect=%2Flead%2Freport");
  });

  it("hint card always shows the 4-role picker (lead/head/admin/viewer)", async () => {
    storeLastRole(HEAD_ROLE);

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    await screen.findByTestId("last-role-hint");
    const switcher = screen.getByTestId("last-role-switcher");
    expect(switcher).toBeInTheDocument();
    for (const role of ["lead", "head", "admin", "viewer"]) {
      expect(
        screen.getByTestId(`last-role-option-${role}`),
      ).toBeInTheDocument();
    }
  });

  it("each picker option links to the seeded email and role default", async () => {
    storeLastRole(HEAD_ROLE);

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const viewerOption = await screen.findByTestId("last-role-option-viewer");
    const href = viewerOption.getAttribute("href") ?? "";
    expect(href).toContain("role=viewer");
    expect(href).toContain("email=viewer%40customreport.local");
    // Viewer lands on the Status entry, not History.
    expect(href).toContain("redirect=%2Freports%2Flatest");
  });
});
