/**
 * verify-a11y VA-0a — UsersTab dialog keyboard / click behavior tests.
 *
 * In-scope rows (unit-rtl high):
 *   - Escape key closes dialog (backdrop biome-ignore noStaticElementInteractions)
 *   - Cancel button closes dialog
 *   - Clicking backdrop closes dialog
 *   - Clicking inside dialog does NOT close it (stopPropagation)
 *
 * tRPC is stubbed via TRPCProxyContext the same way sibling tests do it.
 * The component wires Escape via document.addEventListener in useEffect;
 * backdrop onClick calls setShowDialog(false) directly; inner dialog
 * onClick calls e.stopPropagation().
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";
import type { MockGroup, MockUser } from "./mock-data";
import { UsersTab } from "./users-tab";

// Silence toast calls — the mutations resolve async; these tests don't wait
// for them, so keeping stubs here prevents unhandled-call noise.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Minimal tRPC stub — only the shapes UsersTab actually calls.
// UsersTab calls: saveUser, deleteUser, deactivateUser, activateUser
//   (all mutations). invalidateAdmin also calls pathFilter on several routes.
// ---------------------------------------------------------------------------
function makeMockTRPC() {
  function noopMutationOptions(_opts: Record<string, unknown>): {
    mutationFn: () => Promise<void>;
  } {
    return {
      mutationFn: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
  }
  return {
    admin: {
      saveUser: { mutationOptions: noopMutationOptions },
      deleteUser: { mutationOptions: noopMutationOptions },
      deactivateUser: { mutationOptions: noopMutationOptions },
      activateUser: { mutationOptions: noopMutationOptions },
      // pathFilter stubs consumed by invalidateAdmin
      snapshot: { pathFilter: () => ({ tag: "admin.snapshot" }) },
      getSettings: { pathFilter: () => ({ tag: "admin.getSettings" }) },
      getOrganization: {
        pathFilter: () => ({ tag: "admin.getOrganization" }),
      },
    },
    org: { getPublic: { pathFilter: () => ({ tag: "org.getPublic" }) } },
    auth: { me: { pathFilter: () => ({ tag: "auth.me" }) } },
    weeklyReport: {
      get: { pathFilter: () => ({ tag: "weeklyReport.get" }) },
    },
  } as never;
}

// ---------------------------------------------------------------------------
// Fixed test fixtures
// ---------------------------------------------------------------------------
const GROUP: MockGroup = {
  id: "g1",
  name: "Alpha",
  description: null,
  archived: false,
  headUserId: null,
};

const USER: MockUser = {
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  role: "lead",
  groupId: "g1",
  department: "Alpha",
  isActive: true,
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
function renderTab(users: MockUser[] = [USER], groups: MockGroup[] = [GROUP]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(<UsersTab users={users} groups={groups} />, {
    wrapper: Wrapper,
  });
}

// ---------------------------------------------------------------------------
// Helper: open the Add User dialog
// ---------------------------------------------------------------------------
function openDialog() {
  const addBtn = screen.getByRole("button", { name: /add new user/i });
  fireEvent.click(addBtn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UsersTab — dialog keyboard and click behavior (VA-0a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // catalog row: "dialog backdrop biome-ignore noStaticElementInteractions — Escape closes dialog"
  it("pressing Escape removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    // Dialog is open
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  // catalog row: "dialog backdrop biome-ignore noStaticElementInteractions — Cancel button closes dialog"
  it("clicking Cancel removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  // catalog row: "dialog inner div biome-ignore useKeyWithClickEvents — clicking backdrop closes dialog"
  it("clicking the backdrop div (data-testid=crud-sheet) removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("crud-sheet"));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  // catalog row: "dialog inner div biome-ignore useKeyWithClickEvents — clicking inside dialog does NOT close it (stopPropagation)"
  it("clicking inside the dialog panel (role=dialog) does NOT remove the dialog", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("dialog"));

    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();
  });
});
