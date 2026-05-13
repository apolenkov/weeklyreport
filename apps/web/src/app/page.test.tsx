/**
 * @vitest-environment jsdom
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LAST_ROLE_STORAGE_KEY } from "../lib/last-role";

/**
 * UFB-071 (2026-05-11): landing-page last-role hint tests.
 *
 * Coverage:
 *   - hint is hidden when no record is stored
 *   - hint renders name + role label when a record exists (AUTH_STUB)
 *   - primary CTA href points at the persisted role's dev-login URL
 *   - «Change role» toggles the 5-role picker
 *   - each picker option links to the correct seeded email
 *
 * We test LoginPageClient directly (the client component) — the RSC
 * wrapper page.tsx is a thin async server shell tested via E2E, not unit.
 * See vitest.config.ts coverage.exclude: 'src/app/ ** /page.tsx'.
 *
 * AUTH_STUB is read at module-eval time from the env, so we must set
 * it before importing the client module.
 */

const useQueryMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("../lib/trpc-context", () => ({
  useTRPC: () => ({
    auth: { me: { queryOptions: () => ({ queryKey: ["auth.me"] }) } },
    org: {
      getPublic: { queryOptions: () => ({ queryKey: ["org.getPublic"] }) },
    },
  }),
}));

// Lightweight stubs for landing-only visuals — keep tests focused on
// the last-role hint, not the hero rendering.
vi.mock("../components/landing/pulse-background", () => ({
  PulseBackground: () => null,
}));
vi.mock("../components/landing/pulse-mark", () => ({
  PulseMark: () => null,
}));
vi.mock("../components/landing/tagline-cycler", () => ({
  TaglineCycler: () => null,
}));

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
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

let storage: Storage;

beforeEach(() => {
  // AUTH_STUB is gated on `process.env.NEXT_PUBLIC_AUTH_STUB === 'true'`
  // at the module top-level — set BEFORE importing the client module.
  process.env.NEXT_PUBLIC_AUTH_STUB = "true";

  storage = makeMemoryStorage();
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  // Default: unauthenticated landing.
  useQueryMock.mockImplementation((opts: { queryKey?: readonly unknown[] }) => {
    const key = opts?.queryKey?.[0];
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
  (useQueryMock as Mock).mockReset();
  (useSearchParamsMock as Mock).mockReset();
});

async function loadLoginPageClient() {
  const mod = await import("./login-page.client");
  return mod.LoginPageClient;
}

describe("Landing page — last-role hint (UFB-071)", () => {
  it("does not render the hint when no record is stored", async () => {
    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);
    await waitFor(() => {
      expect(screen.getByTestId("primary-cta")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("last-role-hint")).toBeNull();
  });

  it("renders the hint with name + role label after a record is stored", async () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "head",
        email: "head@customreport.local",
        name: "Антон К.",
      }),
    );

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const hint = await screen.findByTestId("last-role-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("Антон К.");
    expect(hint).toHaveTextContent("Head");
  });

  it("points the primary CTA at the persisted role dev-login URL", async () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "lead",
        email: "lead1@customreport.local",
        name: "Lead 1",
      }),
    );

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

  it("«Change role» toggles a 5-role picker (lead/head/admin/viewer/director)", async () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "head",
        email: "head@customreport.local",
        name: "Антон К.",
      }),
    );

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    const toggle = await screen.findByTestId("last-role-change");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("last-role-switcher")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const switcher = screen.getByTestId("last-role-switcher");
    expect(switcher).toBeInTheDocument();
    for (const role of ["lead", "head", "admin", "viewer", "director"]) {
      expect(
        screen.getByTestId(`last-role-option-${role}`),
      ).toBeInTheDocument();
    }
  });

  it("each picker option links to the seeded email and role default", async () => {
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "head",
        email: "head@customreport.local",
        name: "Антон К.",
      }),
    );

    const LoginPageClient = await loadLoginPageClient();
    render(<LoginPageClient initialOrg={STUB_ORG} />);

    fireEvent.click(await screen.findByTestId("last-role-change"));

    const directorOption = screen.getByTestId("last-role-option-director");
    const href = directorOption.getAttribute("href") ?? "";
    expect(href).toContain("role=director");
    expect(href).toContain("email=director%40customreport.local");
    expect(href).toContain("redirect=%2Fhead%2Fdashboard");
  });
});
