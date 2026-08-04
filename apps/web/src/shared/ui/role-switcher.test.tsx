// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown): unknown => useQueryMock(opts),
  useMutation: (opts: unknown): unknown => useMutationMock(opts),
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    dev: {
      listUsers: { queryOptions: () => ({ queryKey: ["dev.listUsers"] }) },
      wipeAndReseed: {
        mutationOptions: (o: object) => ({ mutationKey: ["wipe"], ...o }),
      },
    },
    auth: { me: { queryOptions: () => ({ queryKey: ["auth.me"] }) } },
  }),
}));

import type { DbRole } from "@customreport/shared";
import { expectTypeOf } from "vitest";

import { DevRoleSwitcher, ROLE_ORDER } from "./role-switcher";

const SEED_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@customreport.local",
  name: "Admin User",
  role: "admin" as const,
};

function primeHooks(sessionRole: string): void {
  useMutationMock.mockReturnValue({ mutate: vi.fn() });
  useQueryMock.mockImplementation((opts: { queryKey?: string[] }) => {
    const key = opts.queryKey?.[0];
    if (key === "auth.me") {
      return { data: { ...SEED_USER, role: sessionRole } };
    }
    return { data: [SEED_USER], isLoading: false, error: null };
  });
}

describe("DevRoleSwitcher — data-reset controls for every dev role", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEV_ROLE_SWITCHER", "true");
    useQueryMock.mockReset();
    useMutationMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the reset controls for an admin dev session", async () => {
    primeHooks("admin");
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));

    expect(
      screen.getByTestId("dev-role-switcher-reseed-minimal"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("dev-role-switcher-reseed-stress"),
    ).toBeInTheDocument();
  });

  it("shows the reset controls for a lead dev session too (dev-only tool)", async () => {
    primeHooks("lead");
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));

    expect(
      screen.getByTestId("dev-role-switcher-reseed-minimal"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("dev-role-switcher-reseed-stress"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dev-role-switcher-logout")).toBeInTheDocument();
  });
});

describe("DevRoleSwitcher — logout honesty", () => {
  const fetchMock = vi.fn();
  // Spy instead of a mutable capture: the assignment history IS the assertion.
  const hrefAssign = vi.fn<(value: string) => void>();
  const realLocation = window.location;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEV_ROLE_SWITCHER", "true");
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    hrefAssign.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(value: string) {
          hrefAssign(value);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("does not redirect and re-enables controls when logout responds non-OK", async () => {
    primeHooks("admin");
    fetchMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    await user.click(screen.getByTestId("dev-role-switcher-logout"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(hrefAssign).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByTestId("dev-role-switcher-trigger"),
      ).not.toBeDisabled(),
    );
  });

  it("redirects home when logout responds OK", async () => {
    primeHooks("admin");
    fetchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    await user.click(screen.getByTestId("dev-role-switcher-logout"));

    await waitFor(() => expect(hrefAssign).toHaveBeenCalledWith("/"));
  });
});

describe("ROLE_ORDER — completeness pin (role-type spec)", () => {
  it("covers every DbRole member exactly", () => {
    // Compile-time: the hand-ordered tuple's member union must equal DbRole,
    // so adding a role to the persistence axis is a test failure until the
    // switcher's picker shows it.
    expectTypeOf<(typeof ROLE_ORDER)[number]>().toEqualTypeOf<DbRole>();
    expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length);
  });
});
