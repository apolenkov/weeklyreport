// Order is deliberate: products → activities → periods → reminders mirrors the
// data flow; jobs and actions group operational work, AI owns its first-class
// configuration surface, and general Settings remains the final destination.
export const ADMIN_TABS = [
  "users",
  "groups",
  "products",
  "activities",
  "periods",
  "reminders",
  "reopen",
  "jobs",
  "actions",
  "ai",
  "settings",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export const ADMIN_TAB_LABELS: Readonly<Record<AdminTab, string>> = {
  users: "Users",
  groups: "Groups",
  products: "Products",
  activities: "Activities",
  periods: "Periods",
  reminders: "Reminders",
  reopen: "Reopen",
  jobs: "Jobs",
  actions: "Actions",
  ai: "AI",
  settings: "Settings",
};

interface AdminTabQueryDependencies {
  readonly snapshot: boolean;
  readonly settings: boolean;
}

export const ADMIN_TAB_QUERY_DEPENDENCIES = {
  users: { snapshot: true, settings: false },
  groups: { snapshot: true, settings: false },
  products: { snapshot: true, settings: false },
  // The activity list is its own query; the snapshot supplies the groups,
  // leads, and products the tab picks from.
  activities: { snapshot: true, settings: false },
  periods: { snapshot: false, settings: false },
  reminders: { snapshot: true, settings: true },
  reopen: { snapshot: false, settings: false },
  jobs: { snapshot: false, settings: false },
  actions: { snapshot: false, settings: false },
  ai: { snapshot: false, settings: false },
  settings: { snapshot: false, settings: true },
} as const satisfies Record<AdminTab, AdminTabQueryDependencies>;

export function isAdminTab(value: string): value is AdminTab {
  return (ADMIN_TABS as readonly string[]).includes(value);
}
