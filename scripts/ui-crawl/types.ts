type Severity = "high" | "medium" | "low";

export type Finding = Readonly<{
  severity: Severity;
  kind: string;
  role: string;
  width: number;
  page: string;
  detail: string;
  shot: string | null;
}>;

export type StepRecord = Readonly<{
  name: string;
  tag: string;
  action: "pressed" | "skipped" | "error";
  reason: string | null;
  urlChanged: boolean;
  stateChanged: boolean;
  restoredBy: "none" | "escape" | "toggle" | "reload" | "navigate";
  responseMs: number | null;
  shot: string | null;
  elementId?: string;
  state?: string;
  depth?: number;
  path?: readonly string[];
  logs?: readonly Readonly<{ kind: string; detail: string }>[];
}>;

export type PageRecord = Readonly<{
  url: string;
  key: string;
  loadMs: number;
  shot: string | null;
  controlsFound: number;
  axeViolations: number;
  geometryIssues: number;
  steps: readonly StepRecord[];
  state?: string;
  depth?: number;
  coverage?: Readonly<{
    found: number;
    pressed: number;
    skipped: number;
    errors: number;
    reasons: Readonly<Record<string, number>>;
  }>;
  states?: readonly Readonly<{
    id: string;
    depth: number;
    path: readonly string[];
    controlsFound: number;
    shot: string;
    signature: string;
    dom?: string;
    status: "observed" | "depth-limit";
  }>[];
  pairwise?: readonly Readonly<{
    values: Readonly<Record<string, string>>;
    status: "observed" | "skipped" | "error";
    reason: string | null;
    shot: string | null;
  }>[];
  completion?: "complete" | "limited" | "error";
}>;

export type RunRecord = Readonly<{
  role: string;
  state?: string;
  width: number;
  ms: number;
  video: string;
  pages: readonly PageRecord[];
  findings: readonly Finding[];
}>;

export type RoleResult = Readonly<{
  role: string;
  ms: number;
  runs: readonly RunRecord[];
}>;

export type Role = Readonly<{
  name: string;
  email: string;
  passwordKey: string;
}>;

export const ROLES: readonly Role[] = [
  { name: "lead", email: "lead1@customreport.local", passwordKey: "PW_LEAD1" },
  { name: "head", email: "head@customreport.local", passwordKey: "PW_HEAD" },
  {
    name: "viewer",
    email: "viewer@customreport.local",
    passwordKey: "PW_VIEWER",
  },
  { name: "admin", email: "admin@customreport.local", passwordKey: "PW_ADMIN" },
];

export type Config = Readonly<{
  mode: "quick" | "full";
  maxDepth: number;
  state: string;
  allowSynthetic: boolean;
  entrypoints: readonly string[];
  fixtureReportId: string | null;
  url: string;
  out: string;
  widths: readonly number[];
  maxControls: number;
  maxPages: number;
  video: boolean;
}>;
