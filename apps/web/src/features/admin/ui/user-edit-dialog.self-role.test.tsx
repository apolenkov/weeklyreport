import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import type { AdminUserView } from "../model/admin-types";
import { formFromUser } from "../model/user-form";
import { UserEditDialog } from "./user-edit-dialog";

const ADMIN: AdminUserView = {
  id: "admin-1",
  name: "Petrov Admin",
  lastName: "Petrov",
  firstName: "Admin",
  middleName: null,
  email: "admin@example.com",
  position: null,
  role: "admin",
  groupId: null,
  department: "Platform",
  isActive: true,
};

function renderDialog(sessionUserId: string) {
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
      <UserEditDialog
        editingUser={ADMIN}
        form={formFromUser(ADMIN)}
        onFormChange={vi.fn()}
        groupOptions={[]}
        activeGroups={[]}
        canSave
        isSaving={false}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    </SessionContext.Provider>,
  );
}

describe("UserEditDialog self role lock", () => {
  it("locks the Role field on the signed-in admin's own record", () => {
    renderDialog("admin-1");
    const role = screen.getByRole("combobox", { name: "Role" });
    expect(role).toBeDisabled();
    expect(role).toHaveAccessibleDescription(/own account/);
  });

  it("keeps Role editable for another admin's record", () => {
    renderDialog("someone-else");
    expect(screen.getByRole("combobox", { name: "Role" })).toBeEnabled();
  });
});
