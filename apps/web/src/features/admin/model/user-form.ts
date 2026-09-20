import type { AdminUserFormInput } from "./admin-form-inputs";
import type { AdminGroupView, AdminUserView } from "./admin-types";

export type UserFormData = AdminUserFormInput;

export function emptyForm(groups: readonly AdminGroupView[]): UserFormData {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    position: "",
    email: "",
    role: "lead",
    groupId: groups.find((group) => !group.archived)?.id ?? null,
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
