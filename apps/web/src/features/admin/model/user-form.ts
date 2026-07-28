import type { DbRole } from "@customreport/shared";

import type { AdminGroupView, AdminUserView } from "./admin-types";

export interface UserFormData {
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  email: string;
  role: DbRole;
  groupId: string;
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
      groups.find((group) => !group.archived)?.id ?? groups.at(0)?.id ?? "",
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
