import type { AdminGroupView } from "./admin-types";

export interface GroupFormData {
  readonly name: string;
  readonly description: string;
  readonly headUserId: string; // empty string = no leader
  readonly archived: boolean;
}

export const EMPTY_GROUP_FORM: GroupFormData = {
  name: "",
  description: "",
  headUserId: "",
  archived: false,
};

export function formFromGroup(group: AdminGroupView): GroupFormData {
  return {
    name: group.name,
    description: group.description ?? "",
    headUserId: group.headUserId ?? "",
    archived: group.archived,
  };
}
