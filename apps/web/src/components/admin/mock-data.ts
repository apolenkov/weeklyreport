/**
 * Mock data for Admin Panel components.
 * Real data will come from tRPC endpoints in a later phase.
 */

// ---- Type Definitions ----

export type UserRole = "lead" | "head" | "admin" | "viewer";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  groupId: string;
  department: string;
};

export type MockGroup = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  // UFB-039: optional FK to a head/admin user (display name resolved via
  // AdminSnapshot.users on the consumer side).
  headUserId: string | null;
};

export const DEFAULT_GROUP_ID = "g1";

export type StageName =
  | "Planning"
  | "Analysis"
  | "Design"
  | "Development"
  | "Testing"
  | "DevOps"
  | "Support";

export const STAGE_NAMES: StageName[] = [
  "Planning",
  "Analysis",
  "Design",
  "Development",
  "Testing",
  "DevOps",
  "Support",
];

export type StageAssignment = {
  stage: StageName;
  assigneeId: string | null;
};

export type MockProduct = {
  id: string;
  name: string;
  leadOwnerId: string;
  stages: StageAssignment[];
  status: "active" | "archived";
};

export type PeriodStatus = "open" | "published" | "reopened";

export type MockPeriod = {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  deadline: string;
  status: PeriodStatus;
};

export type MockReminder = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  kind: "deadline" | "follow_up" | "escalation";
  fireAt: Date;
  timezone: string;
  version: number;
  reportId: string | null;
  /** UFB-036 (Phase 44-04): policy FK so derived rules can be grouped. */
  policyId: string | null;
};

/**
 * UFB-036 (Phase 44-04): presentation type for the Reminders Tab policy
 * editor. Mirrors `reminderPolicySchema` 1:1.
 */
export type MockReminderPolicy = {
  id: string;
  kind: "deadline" | "follow_up" | "escalation";
  offsetMinutes: number;
  timezone: string;
  audience: "lead-with-draft" | "head-of-late";
  active: boolean;
  validFrom: Date;
  validUntil: Date | null;
};

export type MockSettings = {
  departmentName: string;
  autoCreatePeriods: boolean;
  defaultDeadlineDays: number;
};

// ---- Mock Users (8 total: 6 leads + 1 head + 1 viewer) ----

export const MOCK_GROUPS: MockGroup[] = [
  {
    id: DEFAULT_GROUP_ID,
    name: "Software Development",
    description: "Default reporting group",
    archived: false,
    headUserId: null,
  },
];

export const MOCK_USERS: MockUser[] = [
  {
    id: "u1",
    name: "Alexey Petrov",
    email: "a.petrov@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u2",
    name: "Maria Ivanova",
    email: "m.ivanova@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u3",
    name: "Dmitry Sosnov",
    email: "d.sosnov@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u4",
    name: "Elena Kashtanova",
    email: "e.kashtanova@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u5",
    name: "Sergey Vetrov",
    email: "s.vetrov@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u6",
    name: "Anna Floksova",
    email: "a.floksova@example.com",
    role: "lead",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u7",
    name: "Igor Smirnov",
    email: "i.smirnov@example.com",
    role: "head",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
  {
    id: "u8",
    name: "Olga Mirtova",
    email: "o.mirtova@example.com",
    role: "viewer",
    groupId: DEFAULT_GROUP_ID,
    department: "Software Development",
  },
];

// ---- Mock Products (12 total) ----

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "p1",
    name: "CRM Portal",
    leadOwnerId: "u1",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u1" },
      { stage: "Analysis", assigneeId: "u2" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u1" },
      { stage: "Testing", assigneeId: "u4" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p2",
    name: "Analytics Dashboard",
    leadOwnerId: "u2",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u2" },
      { stage: "Analysis", assigneeId: "u2" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u4" },
      { stage: "Testing", assigneeId: "u5" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p3",
    name: "Mobile App",
    leadOwnerId: "u3",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u3" },
      { stage: "Analysis", assigneeId: "u1" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u3" },
      { stage: "Testing", assigneeId: "u4" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p4",
    name: "Payment Gateway",
    leadOwnerId: "u4",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u4" },
      { stage: "Analysis", assigneeId: "u4" },
      { stage: "Design", assigneeId: "u2" },
      { stage: "Development", assigneeId: "u4" },
      { stage: "Testing", assigneeId: "u1" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p5",
    name: "Inventory System",
    leadOwnerId: "u5",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u5" },
      { stage: "Analysis", assigneeId: "u1" },
      { stage: "Design", assigneeId: "u2" },
      { stage: "Development", assigneeId: "u5" },
      { stage: "Testing", assigneeId: "u3" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p6",
    name: "HR Portal",
    leadOwnerId: "u6",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u6" },
      { stage: "Analysis", assigneeId: "u6" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u6" },
      { stage: "Testing", assigneeId: "u4" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u1" },
    ],
  },
  {
    id: "p7",
    name: "Document Manager",
    leadOwnerId: "u1",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u1" },
      { stage: "Analysis", assigneeId: "u2" },
      { stage: "Design", assigneeId: null },
      { stage: "Development", assigneeId: null },
      { stage: "Testing", assigneeId: null },
      { stage: "DevOps", assigneeId: null },
      { stage: "Support", assigneeId: null },
    ],
  },
  {
    id: "p8",
    name: "Chat Platform",
    leadOwnerId: "u2",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u2" },
      { stage: "Analysis", assigneeId: "u3" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u2" },
      { stage: "Testing", assigneeId: "u4" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p9",
    name: "Notification Service",
    leadOwnerId: "u3",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u3" },
      { stage: "Analysis", assigneeId: "u4" },
      { stage: "Design", assigneeId: null },
      { stage: "Development", assigneeId: "u3" },
      { stage: "Testing", assigneeId: "u1" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: null },
    ],
  },
  {
    id: "p10",
    name: "Reporting Engine",
    leadOwnerId: "u4",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u4" },
      { stage: "Analysis", assigneeId: "u1" },
      { stage: "Design", assigneeId: "u2" },
      { stage: "Development", assigneeId: "u4" },
      { stage: "Testing", assigneeId: "u6" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u3" },
    ],
  },
  {
    id: "p11",
    name: "API Gateway",
    leadOwnerId: "u5",
    status: "archived",
    stages: [
      { stage: "Planning", assigneeId: "u5" },
      { stage: "Analysis", assigneeId: "u5" },
      { stage: "Design", assigneeId: "u2" },
      { stage: "Development", assigneeId: "u5" },
      { stage: "Testing", assigneeId: "u4" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u6" },
    ],
  },
  {
    id: "p12",
    name: "Auth Service",
    leadOwnerId: "u6",
    status: "active",
    stages: [
      { stage: "Planning", assigneeId: "u6" },
      { stage: "Analysis", assigneeId: "u1" },
      { stage: "Design", assigneeId: "u3" },
      { stage: "Development", assigneeId: "u6" },
      { stage: "Testing", assigneeId: "u2" },
      { stage: "DevOps", assigneeId: "u5" },
      { stage: "Support", assigneeId: "u4" },
    ],
  },
];

// ---- Mock Periods (4 total) ----

export const MOCK_PERIODS: MockPeriod[] = [
  {
    id: "per1",
    weekLabel: "Week 16",
    startDate: "2026-04-13",
    endDate: "2026-04-19",
    deadline: "2026-04-18",
    status: "published",
  },
  {
    id: "per2",
    weekLabel: "Week 17",
    startDate: "2026-04-20",
    endDate: "2026-04-26",
    deadline: "2026-04-25",
    status: "open",
  },
  {
    id: "per3",
    weekLabel: "Week 15",
    startDate: "2026-04-06",
    endDate: "2026-04-12",
    deadline: "2026-04-11",
    status: "published",
  },
  {
    id: "per4",
    weekLabel: "Week 14",
    startDate: "2026-03-30",
    endDate: "2026-04-05",
    deadline: "2026-04-04",
    status: "published",
  },
];

// ---- Mock Reminders (3 rules) ----

export const MOCK_REMINDERS: MockReminder[] = [
  {
    id: "rem1",
    name: "On Deadline Day",
    description:
      "Send reminder to leads who have not submitted on the deadline day",
    active: true,
    kind: "deadline",
    fireAt: new Date("2026-04-25T15:00:00.000Z"),
    timezone: "Europe/Moscow",
    version: 1,
    reportId: null,
    policyId: null,
  },
  {
    id: "rem2",
    name: "24h Before Deadline",
    description: "Send reminder to leads 24 hours before the period deadline",
    active: true,
    kind: "deadline",
    fireAt: new Date("2026-04-24T15:00:00.000Z"),
    timezone: "Europe/Moscow",
    version: 1,
    reportId: null,
    policyId: null,
  },
  {
    id: "rem3",
    name: "Weekly Summary",
    description:
      "Send weekly summary of submission status to the reporting head",
    active: false,
    kind: "follow_up",
    fireAt: new Date("2026-04-26T15:00:00.000Z"),
    timezone: "Europe/Moscow",
    version: 1,
    reportId: null,
    policyId: null,
  },
];

// ---- Mock Settings ----

export const MOCK_SETTINGS: MockSettings = {
  departmentName: "Software Development",
  autoCreatePeriods: true,
  defaultDeadlineDays: 5,
};

// ---- Helpers ----

export function getUserById(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

export function getLeadUsers(): MockUser[] {
  return MOCK_USERS.filter((u) => u.role === "lead");
}
