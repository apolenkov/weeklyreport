// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const cancelQueriesMock = vi.fn<() => Promise<void>>();
const refetchQueriesMock =
  vi.fn<(filters: { readonly type: "active" }) => Promise<void>>();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown): unknown => useQueryMock(opts),
  useMutation: (opts: unknown): unknown => useMutationMock(opts),
  useQueryClient: () => ({
    cancelQueries: cancelQueriesMock,
    refetchQueries: refetchQueriesMock,
  }),
}));

vi.mock("../../lib/trpc/trpc-context", () => ({
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

import { expectDefined } from "../../../test-utils/expect-defined.js";
import * as sessionTransition from "../../lib/auth/session-transition";
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

  it("gives the icon-only trigger a discernible accessible name", () => {
    primeHooks("head");

    render(<DevRoleSwitcher />);

    expect(
      screen.getByRole("button", { name: "Switch development role" }),
    ).toHaveAttribute("title", "Switch development role");
  });

  it("keeps the compact trigger at the mobile touch-target floor", () => {
    primeHooks("head");
    render(<DevRoleSwitcher />);

    expect(screen.getByTestId("dev-role-switcher-trigger")).toHaveClass(
      "max-md:min-h-[var(--touch-target-min)]",
      "max-md:min-w-[var(--touch-target-min)]",
      "h-8",
    );
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
    expect(screen.getByRole("menu")).toHaveClass(
      "w-72",
      "max-w-[calc(100vw-1rem)]",
    );
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

    for (const testId of [
      "dev-role-switcher-admin-admin@customreport.local",
      "dev-role-switcher-reseed-minimal",
      "dev-role-switcher-reseed-demo",
      "dev-role-switcher-reseed-full",
      "dev-role-switcher-reseed-stress",
      "dev-role-switcher-logout",
    ]) {
      expect(screen.getByTestId(testId)).toHaveClass(
        "max-md:min-h-[var(--touch-target-min)]",
      );
    }
  });
});

describe("DevRoleSwitcher — logout honesty", () => {
  const fetchMock = vi.fn();
  // Spy instead of a mutable capture: the assignment history IS the assertion.
  const hrefAssign = vi.fn<(value: string) => void>();
  const realLocation = window.location;
  // The transition is module state and a successful logout never releases it
  // (the page unloads), so finish every handle a test opened.
  const transitionHandles: sessionTransition.SessionTransitionHandle[] = [];

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEV_ROLE_SWITCHER", "true");
    const begin = sessionTransition.beginSessionTransition;
    vi.spyOn(sessionTransition, "beginSessionTransition").mockImplementation(
      () => {
        const handle = begin();
        if (handle) transitionHandles.push(handle);
        return handle;
      },
    );
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    cancelQueriesMock.mockReset();
    cancelQueriesMock.mockResolvedValue(undefined);
    refetchQueriesMock.mockReset();
    refetchQueriesMock.mockResolvedValue(undefined);
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
    for (const handle of transitionHandles.splice(0)) handle.finish();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("waits for active queries to stop before changing the session", async () => {
    primeHooks("admin");
    const cancellation = {
      resolve: undefined as (() => void) | undefined,
    };
    cancelQueriesMock.mockReturnValue(
      new Promise<void>((resolve) => {
        cancellation.resolve = resolve;
      }),
    );
    fetchMock.mockResolvedValue({ ok: false });
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    const trigger = screen.getByTestId("dev-role-switcher-trigger");
    await user.click(trigger);
    await user.click(screen.getByTestId("dev-role-switcher-logout"));

    await waitFor(() => expect(cancelQueriesMock).toHaveBeenCalledOnce());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trigger).toBeDisabled();

    expectDefined(cancellation.resolve)();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(trigger).not.toBeDisabled());
    expect(refetchQueriesMock).toHaveBeenCalledWith({ type: "active" });
  });

  it("recovers when another session control already owns navigation", async () => {
    primeHooks("admin");
    const transition = sessionTransition.beginSessionTransition();
    expect(transition).not.toBeNull();
    const user = userEvent.setup();

    try {
      render(<DevRoleSwitcher />);
      const trigger = screen.getByTestId("dev-role-switcher-trigger");
      await user.click(trigger);
      await user.click(screen.getByTestId("dev-role-switcher-logout"));

      await waitFor(() => expect(trigger).not.toBeDisabled());
      expect(cancelQueriesMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      transition?.finish();
    }
  });

  it("does not redirect and re-enables controls when logout responds non-OK", async () => {
    primeHooks("admin");
    const logoutResponse = {
      resolve: undefined as ((response: { ok: boolean }) => void) | undefined,
    };
    fetchMock.mockReturnValue(
      new Promise<{ ok: boolean }>((resolve) => {
        logoutResponse.resolve = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    const trigger = screen.getByTestId("dev-role-switcher-trigger");
    await user.click(trigger);
    await user.click(screen.getByTestId("dev-role-switcher-logout"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(cancelQueriesMock).toHaveBeenCalledOnce();
    expect(hrefAssign).not.toHaveBeenCalled();
    expect(trigger).toBeDisabled();
    trigger.blur();
    expectDefined(logoutResponse.resolve)({ ok: false });
    await waitFor(() => {
      expect(trigger).not.toBeDisabled();
      expect(trigger).toHaveFocus();
    });
  });

  it("re-enables and restores trigger focus after reseed fails", async () => {
    const reseedFailure = {
      onError: undefined as ((error: Error) => void) | undefined,
    };
    primeHooks("admin");
    useMutationMock.mockImplementation(
      (options: { readonly onError?: (error: Error) => void }) => {
        reseedFailure.onError = options.onError;
        return { mutate: vi.fn() };
      },
    );
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    const trigger = screen.getByTestId("dev-role-switcher-trigger");
    await user.click(trigger);
    await user.click(screen.getByTestId("dev-role-switcher-reseed-demo"));
    await user.click(screen.getByRole("button", { name: /wipe \+ reseed/i }));

    expect(trigger).toBeDisabled();
    trigger.blur();
    expectDefined(reseedFailure.onError)(new Error("reseed failed"));

    await waitFor(() => {
      expect(trigger).not.toBeDisabled();
      expect(trigger).toHaveFocus();
    });
  });

  it("redirects home when logout responds OK", async () => {
    primeHooks("admin");
    fetchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    await user.click(screen.getByTestId("dev-role-switcher-logout"));

    await waitFor(() => expect(hrefAssign).toHaveBeenCalledWith("/"));
    expect(cancelQueriesMock).toHaveBeenCalledOnce();
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
