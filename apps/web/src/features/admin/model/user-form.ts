import type { DbRole } from "@customreport/shared";

import type { MockGroup, MockUser } from "../../../shared/lib/admin-mock-data";

export interface UserFormData {
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  email: string;
  role: DbRole;
  groupId: string;
}

export function emptyForm(groups: readonly MockGroup[]): UserFormData {
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

export function formFromUser(user: MockUser): UserFormData {
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
