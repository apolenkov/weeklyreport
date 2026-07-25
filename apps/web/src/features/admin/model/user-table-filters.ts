import { ROLE_LABEL, sessionRoleSchema } from "@customreport/shared";

import type { MockGroup, MockUser } from "./admin-types";

export const USER_ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles" },
  ...sessionRoleSchema.options.map((role) => ({
    value: role,
    label: ROLE_LABEL[role],
  })),
];

export const USER_STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

export type UserStatusFilter =
  (typeof USER_STATUS_FILTER_OPTIONS)[number]["value"];

/**
 * User Group Filter Options.
 * @param groups - The groups argument.
 */
export function userGroupFilterOptions(groups: readonly MockGroup[]) {
  return [
    { value: "", label: "All groups" },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ];
}

interface UserTableFilters {
  readonly search: string;
  readonly role: string;
  readonly groupId: string;
  readonly status: UserStatusFilter;
}

function matchesSearch(user: MockUser, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  return [
    user.name,
    user.email,
    user.role,
    user.department,
    user.position ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * Filter Admin Users.
 * @param users - The users argument.
 * @param filters - The filters argument.
 */
export function filterAdminUsers(
  users: readonly MockUser[],
  filters: UserTableFilters,
): MockUser[] {
  return users.filter((user) => {
    if (filters.role !== "" && user.role !== filters.role) return false;
    if (filters.groupId !== "" && user.groupId !== filters.groupId)
      return false;
    if (filters.status === "active" && !user.isActive) return false;
    if (filters.status === "inactive" && user.isActive) return false;
    return matchesSearch(user, filters.search);
  });
}
