export const ADMIN_TABS = [
  "users",
  "groups",
  "products",
  "periods",
  "reminders",
  "reopen",
  "jobs",
  "actions",
  "settings",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

interface AdminTabQueryDependencies {
  readonly snapshot: boolean;
  readonly settings: boolean;
}

export const ADMIN_TAB_QUERY_DEPENDENCIES = {
  users: { snapshot: true, settings: false },
  groups: { snapshot: true, settings: false },
  products: { snapshot: true, settings: false },
  periods: { snapshot: false, settings: false },
  reminders: { snapshot: true, settings: true },
  reopen: { snapshot: false, settings: false },
  jobs: { snapshot: false, settings: false },
  actions: { snapshot: false, settings: false },
  settings: { snapshot: false, settings: true },
} as const satisfies Record<AdminTab, AdminTabQueryDependencies>;

export function isAdminTab(value: string): value is AdminTab {
  return (ADMIN_TABS as readonly string[]).includes(value);
}
