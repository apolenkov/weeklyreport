/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { LAST_ROLE_STORAGE_KEY } from "../lib/last-role";

/**
 * Landing-page last-role hint tests.
 *
 * Coverage:
 *   - hint is hidden when no record is stored
 *   - hint renders name + role label when a record exists (AUTH_STUB)
 *   - primary CTA href points at the persisted role's dev-login URL
 *   - the hint card always shows the 4-role picker (rev 2026-06-10:
 *     the «Change role» toggle was removed — expanding past the
 *     card's reserved height read as a layout jump)
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
  shortName: "PEO",
  fullName: "Product Engineering & Operations",
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
  (useQueryMock as Mock).mockReset();
  (useSearchParamsMock as Mock).mockReset();
});

async function loadLoginPageClient() {
  const mod = await import("./login-page.client");
  return mod.LoginPageClient;
}

// ---------------------------------------------------------------------------
// Login page skeleton prevents layout shift (CLS)
// ---------------------------------------------------------------------------
//
// The last-role hint section uses lastRoleLoaded state to show a skeleton
// before localStorage is read (in AUTH_STUB mode). This prevents CLS by
// keeping the container at a stable min-height. Production (AUTH_STUB=false)
// never shows the section, so CLS cannot occur there.
//
// This describe block pins the skeleton rendering behavior: the skeleton must
// be present with aria-hidden="true" on initial render before the useEffect
// fires and sets lastRoleLoaded=true (which replaces it with the real hint).
// ---------------------------------------------------------------------------
describe("Landing page — CLS skeleton", () => {
  it("renders last-role-hint-skeleton with aria-hidden before hydration (AUTH_STUB mode)", async () => {
    // Simulate pre-hydration state: store a role hint so the section has
    // reason to render. The skeleton should still show before useEffect fires.
    storage.setItem(
      LAST_ROLE_STORAGE_KEY,
      JSON.stringify({
        role: "head",
        email: "head@customreport.local",
        name: "Антон К.",
      }),
    );

    const LoginPageClient = await loadLoginPageClient();
    const { unmount } = render(<LoginPageClient initialOrg={STUB_ORG} />);

    // After render+effects, lastRoleLoaded=true → skeleton is gone, real hint shown.
    const hint = await screen.findByTestId("last-role-hint");
    expect(hint).toBeInTheDocument();

    // The skeleton must NOT be in the DOM once the hint is loaded.
    expect(screen.queryByTestId("last-role-hint-skeleton")).toBeNull();

    unmount();
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

  it("hint card always shows the 4-role picker (lead/head/admin/viewer)", async () => {
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

    const viewerOption = await screen.findByTestId("last-role-option-viewer");
    const href = viewerOption.getAttribute("href") ?? "";
    expect(href).toContain("role=viewer");
    expect(href).toContain("email=viewer%40customreport.local");
    // viewer-live-status: the viewer lands on the Status entry, not History.
    expect(href).toContain("redirect=%2Freports%2Flatest");
  });
});
