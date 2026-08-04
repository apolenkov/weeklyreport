import { ROLE_LABEL, sessionRoleSchema } from "@customreport/shared";

import type { AdminGroupView, AdminUserView } from "./admin-types";

export type UserRoleFilter = (typeof sessionRoleSchema.options)[number] | "all";
// null = "all groups" (explicit absence); a group id otherwise. The DOM option
// uses the "all" literal and is converted at the boundary.
export type UserGroupFilter = string | null;

export const USER_ROLE_FILTER_OPTIONS: readonly {
  readonly value: UserRoleFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "All roles" },
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

export function userGroupFilterOptions(
  groups: readonly AdminGroupView[],
): readonly { readonly value: string; readonly label: string }[] {
  return [
    { value: "all", label: "All groups" },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ];
}

interface UserTableFilters {
  readonly search: string;
  readonly role: UserRoleFilter;
  readonly groupId: UserGroupFilter;
  readonly status: UserStatusFilter;
}

function matchesSearch(user: AdminUserView, search: string): boolean {
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

export function filterAdminUsers(
  users: readonly AdminUserView[],
  filters: UserTableFilters,
): readonly AdminUserView[] {
  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.groupId !== null && user.groupId !== filters.groupId)
      return false;
    if (filters.status === "active" && !user.isActive) return false;
    if (filters.status === "inactive" && user.isActive) return false;
    return matchesSearch(user, filters.search);
  });
}
