// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

import type { DbRole } from "@weeklyreport/shared";
import { expectTypeOf } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { makeQueryState } from "../../../test-utils/query-state";
import * as sessionTransition from "../../lib/auth/session-transition";
import { logClientError } from "../../lib/errors/client-error-reporting";
import { DevRoleSwitcher, ROLE_ORDER } from "./role-switcher";

vi.mock("../../lib/errors/client-error-reporting", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../lib/errors/client-error-reporting")
  >()),
  logClientError: vi.fn(),
}));

const SEED_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@weeklyreport.local",
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

  it("logs user load failures once per new error and keeps retry recovery", async () => {
    const first = new Error("users failed");
    const refetch = vi.fn().mockResolvedValue(undefined);
    useMutationMock.mockReturnValue({ mutate: vi.fn() });
    useQueryMock.mockReturnValue(
      makeQueryState({ data: undefined, error: first, refetch }),
    );
    const rendered = render(<DevRoleSwitcher />);
    expect(logClientError).toHaveBeenCalledWith(
      "devRoleSwitcher.users.load_failed",
      first,
      { component: "DevRoleSwitcher", procedure: "dev.listUsers" },
    );
    rendered.rerender(<DevRoleSwitcher />);
    expect(logClientError).toHaveBeenCalledTimes(1);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    await user.click(screen.getByText("Retry loading users"));
    expect(refetch).toHaveBeenCalledOnce();
    useQueryMock.mockReturnValue(makeQueryState({ data: [SEED_USER] }));
    rendered.rerender(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    expect(screen.getByText(SEED_USER.name)).toBeInTheDocument();
    useQueryMock.mockReturnValue(
      makeQueryState({ data: [SEED_USER], error: new Error("new failure") }),
    );
    rendered.rerender(<DevRoleSwitcher />);
    expect(logClientError).toHaveBeenCalledTimes(2);
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
      "dev-role-switcher-admin-admin@weeklyreport.local",
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

  it("keeps the reset confirmation open and locked while the wipe is pending", async () => {
    const reseed = {
      onError: undefined as ((error: Error) => void) | undefined,
      mutate: vi.fn(),
    };
    primeHooks("admin");
    useMutationMock.mockImplementation(
      (options: { readonly onError?: (error: Error) => void }) => {
        reseed.onError = options.onError;
        return { mutate: reseed.mutate };
      },
    );
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    const trigger = screen.getByTestId("dev-role-switcher-trigger");
    await user.click(trigger);
    await user.click(screen.getByTestId("dev-role-switcher-reseed-demo"));
    await user.click(screen.getByRole("button", { name: /wipe \+ reseed/i }));

    expect(reseed.mutate).toHaveBeenCalledExactlyOnceWith({ variant: "demo" });
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Wipe and reseed the demo dataset");
    const confirm = within(dialog).getByRole("button", {
      name: /wipe \+ reseed/i,
    });
    const cancel = within(dialog).getByRole("button", { name: /^cancel$/i });
    await waitFor(() => {
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute("aria-busy", "true");
    });
    expect(cancel).toBeDisabled();
    expect(trigger).toBeDisabled();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(cancel);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(confirm);
    expect(reseed.mutate).toHaveBeenCalledOnce();

    act(() => expectDefined(reseed.onError)(new Error("reseed failed")));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("closes the reset confirmation and leaves through logout when the wipe succeeds", async () => {
    const reseed = {
      onSuccess: undefined as (() => void) | undefined,
    };
    primeHooks("admin");
    useMutationMock.mockImplementation(
      (options: { readonly onSuccess?: () => void }) => {
        reseed.onSuccess = options.onSuccess;
        return { mutate: vi.fn() };
      },
    );
    fetchMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<DevRoleSwitcher />);
    await user.click(screen.getByTestId("dev-role-switcher-trigger"));
    await user.click(screen.getByTestId("dev-role-switcher-reseed-demo"));
    await user.click(screen.getByRole("button", { name: /wipe \+ reseed/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    act(() => expectDefined(reseed.onSuccess)());

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(hrefAssign).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });

  it.each(ROLE_ORDER)(
    "preserves param-less encoded %s dev-login after logout",
    async (role) => {
      const email = `${role}+qa@example.test`;
      primeHooks("admin");
      useQueryMock.mockReturnValue(
        makeQueryState({ data: [{ ...SEED_USER, role, email }] }),
      );
      fetchMock.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(<DevRoleSwitcher />);
      await user.click(screen.getByTestId("dev-role-switcher-trigger"));
      await user.click(
        screen.getByTestId(`dev-role-switcher-${role}-${email}`),
      );
      await waitFor(() => expect(hrefAssign).toHaveBeenCalledOnce());
      const url = new URL(
        expectDefined(hrefAssign.mock.lastCall?.[0]),
        "http://web.test",
      );
      expect(url.pathname).toBe("/auth/dev-login");
      expect(Object.fromEntries(url.searchParams)).toEqual({ role, email });
      expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    },
  );

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
