import type { DbRole } from "@customreport/shared";

import type { AdminGroupView, AdminUserView } from "./admin-types";

export interface UserFormData {
  readonly lastName: string;
  readonly firstName: string;
  readonly middleName: string;
  readonly position: string;
  readonly email: string;
  readonly role: DbRole;
  // null = no owning group (viewer, or none selectable); never an empty id.
  readonly groupId: string | null;
}

export function emptyForm(groups: readonly AdminGroupView[]): UserFormData {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    position: "",
    email: "",
    role: "lead",
    groupId:
      groups.find((group) => !group.archived)?.id ?? groups.at(0)?.id ?? null,
  };
}

export function formFromUser(user: AdminUserView): UserFormData {
  return {
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName ?? "",
    position: user.position ?? "",
    email: user.email,
    role: user.role,
    groupId: user.groupId,
  };
}
