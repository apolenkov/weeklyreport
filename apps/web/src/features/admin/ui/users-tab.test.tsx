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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { MockGroup, MockUser } from "../model/admin-types";
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
function buildProxy() {
  return createMockTRPC([
    { path: ["admin", "saveUser"], mutation: true },
    { path: ["admin", "deleteUser"], mutation: true },
    { path: ["admin", "deactivateUser"], mutation: true },
    { path: ["admin", "activateUser"], mutation: true },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    { path: ["admin", "getOrganization"] },
    { path: ["org", "getPublic"] },
    { path: ["auth", "me"] },
    { path: ["weeklyReport", "get"] },
  ]);
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
  name: "Ivanova Alice",
  lastName: "Ivanova",
  firstName: "Alice",
  middleName: null,
  position: "Team Lead",
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
  const { proxy, captured } = buildProxy();
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  render(<UsersTab users={users} groups={groups} />, { wrapper: Wrapper });
  return { qc, captured };
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

// D4 (design): pin the non-vacuous invalidation fix — after Save success
// invalidateAdmin must call invalidateQueries with the specific
// admin.getOrganization queryKey (not the vacuous { tag } filter).
describe("UsersTab — invalidation contract (D4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Save user invalidates admin.getOrganization by its specific queryKey", async () => {
    const { qc, captured } = renderTab([], [GROUP]);
    captured["admin.saveUser"].mutationFn.mockResolvedValue(undefined);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    openDialog();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^last name$/i), "Petrov");
    await user.type(screen.getByLabelText(/^first name$/i), "Ivan");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");

    await user.click(screen.getByRole("button", { name: /^add user$/i }));

    // invalidateAdmin fires synchronously inside onSuccess; wait for it.
    const orgQueryKey = [["admin", "getOrganization"]];
    await waitFor(() => {
      const calledKeys = invalidateSpy.mock.calls.map((c) =>
        JSON.stringify(c[0]),
      );
      expect(
        calledKeys.some((k) => k.includes(JSON.stringify(orgQueryKey))),
      ).toBe(true);
    });
  });
});

// admin-dialog-focus-management (autofocus-admin-dialogs)
describe("UsersTab — focus management (autofocus-admin-dialogs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("last-name input receives focus when the dialog opens (autoFocus)", () => {
    renderTab();
    openDialog();

    const input = screen.getByLabelText(/^last name$/i);
    // React honours autoFocus on conditionally-mounted elements in jsdom;
    // dropping the autoFocus wiring in production code fails this assert.
    expect(input).toHaveFocus();
  });

  it("focus returns to the trigger button after the dialog closes via Cancel", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: /add new user/i });
    addBtn.focus();
    fireEvent.click(addBtn);

    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });

  it("focus returns to the trigger button after the dialog closes via Escape", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: /add new user/i });
    addBtn.focus();
    fireEvent.click(addBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });
});

describe("UsersTab — delete modal focus management (dialog-listbox-a11y)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function openDeleteModal() {
    const trigger = screen.getByRole("button", {
      name: /delete ivanova alice/i,
    });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it("closes on Escape and restores focus to the row's delete trigger", () => {
    renderTab();
    const trigger = openDeleteModal();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on backdrop click and restores focus to the delete trigger", () => {
    renderTab();
    const trigger = openDeleteModal();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) return;
    fireEvent.click(backdrop);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("does NOT close when clicking inside the modal (stopPropagation)", () => {
    renderTab();
    openDeleteModal();

    fireEvent.click(screen.getByRole("alertdialog"));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("UsersTab — role label rendering (unify-role-label-presentation)", () => {
  it("renders the head role's badge with the shared label, not the raw token", () => {
    const headUser: MockUser = { ...USER, id: "u2", role: "head" };
    renderTab([headUser]);

    const row = screen.getByText(headUser.email).closest("tr");
    expect(row).not.toBeNull();
    const badge = within(row as HTMLElement).getByText(/^Head$/);
    expect(badge.textContent).toBe("Head");
  });
});
