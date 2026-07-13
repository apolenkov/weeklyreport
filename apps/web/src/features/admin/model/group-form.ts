import type { MockGroup } from "../../../shared/lib/admin-mock-data";

export interface GroupFormData {
  name: string;
  description: string;
  headUserId: string; // empty string = no leader
  archived: boolean;
}

export const EMPTY_GROUP_FORM: GroupFormData = {
  name: "",
  description: "",
  headUserId: "",
  archived: false,
};

export function formFromGroup(group: MockGroup): GroupFormData {
  return {
    name: group.name,
    description: group.description ?? "",
    headUserId: group.headUserId ?? "",
    archived: group.archived,
  };
}
