import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import type { AdminUserView } from "../model/admin-types";
import { UserRowActions } from "./user-row-actions";

const ADMIN: AdminUserView = {
  id: "admin-1",
  name: "Petrov Admin",
  lastName: "Petrov",
  firstName: "Admin",
  middleName: null,
  email: "admin@example.com",
  position: null,
  role: "admin",
  groupId: "group-1",
  department: "Platform",
  isActive: true,
};

function renderRow(user: AdminUserView, sessionUserId: string) {
  return render(
    <SessionContext.Provider
      value={{
        user: {
          id: sessionUserId,
          name: "Me",
          email: "me@example.com",
          role: "admin",
        },
        organization: null,
        isLoading: false,
        isAuthenticated: true,
      }}
    >
      <UserRowActions
        user={user}
        deactivatePending={false}
        activatePending={false}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
      />
    </SessionContext.Provider>,
  );
}

describe("UserRowActions self-protection", () => {
  it("disables Deactivate on the signed-in admin's own row and explains why", () => {
    renderRow(ADMIN, "admin-1");
    const button = screen.getByRole("button", { name: /^Deactivate Petrov/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/own account/);
  });

  it("keeps Deactivate enabled for another user's row", () => {
    renderRow(ADMIN, "someone-else");
    expect(
      screen.getByRole("button", { name: "Deactivate Petrov Admin" }),
    ).toBeEnabled();
  });

  it("disables Delete user in the overflow menu on the own row", async () => {
    renderRow(ADMIN, "admin-1");
    await userEvent.click(
      screen.getByRole("button", { name: /^More actions for Petrov/ }),
    );
    expect(
      await screen.findByRole("menuitem", { name: /Delete user/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
