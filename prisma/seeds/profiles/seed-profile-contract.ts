import {
  ACTIVE_REPORT_ID,
  ADMIN_USER_ID,
  HEAD_USER_ID,
  LEAD_1_ID,
  PUBLISHED_REPORT_ID,
  VIEWER_USER_ID,
} from "../support/seed-constants.js";

export const SEED_PROFILES = ["minimal", "demo", "full", "stress"] as const;

export type SeedProfile = (typeof SEED_PROFILES)[number];

export type SeedCapability =
  | "admin-examples"
  | "archive-flow"
  | "canonical-identities"
  | "deep-history"
  | "editable-active-report"
  | "foreign-content"
  | "health-states"
  | "multi-role-access"
  | "ownership"
  | "policy-examples"
  | "project-activities"
  | "publish-flow"
  | "published-period"
  | "reminders"
  | "reopen-flow"
  | "stress-volume"
  | "submission-contrast";

export type SeedCountDimension =
  "users" | "projects" | "reports" | "sections" | "items";

export interface SeedCountBound {
  readonly min: number;
  readonly max: number;
}

export interface SeedProfileManifest {
  readonly profile: SeedProfile;
  readonly purpose: string;
  readonly capabilities: readonly SeedCapability[];
  readonly stableIds: Readonly<Record<string, string>>;
  readonly counts: Readonly<Record<SeedCountDimension, SeedCountBound>>;
}

const CORE_IDS = {
  activeReport: ACTIVE_REPORT_ID,
  head: HEAD_USER_ID,
  lead: LEAD_1_ID,
} as const;

const ROLE_IDS = {
  ...CORE_IDS,
  admin: ADMIN_USER_ID,
  publishedReport: PUBLISHED_REPORT_ID,
  viewer: VIEWER_USER_ID,
} as const;

const MINIMAL_CAPABILITIES = [
  "canonical-identities",
  "editable-active-report",
] as const satisfies readonly SeedCapability[];

const DEMO_CAPABILITIES = [
  ...MINIMAL_CAPABILITIES,
  "foreign-content",
  "health-states",
  "multi-role-access",
  "ownership",
  "published-period",
  "reminders",
  "submission-contrast",
] as const satisfies readonly SeedCapability[];

const FULL_CAPABILITIES = [
  ...DEMO_CAPABILITIES,
  "admin-examples",
  "archive-flow",
  "deep-history",
  "policy-examples",
  "project-activities",
  "publish-flow",
  "reopen-flow",
] as const satisfies readonly SeedCapability[];

export const SEED_PROFILE_MANIFESTS = {
  minimal: {
    profile: "minimal",
    purpose: "Fast boot, authentication, and one editable-report write",
    capabilities: MINIMAL_CAPABILITIES,
    stableIds: CORE_IDS,
    counts: {
      users: { min: 4, max: 9 },
      projects: { min: 1, max: 12 },
      reports: { min: 1, max: 5 },
      sections: { min: 1, max: 30 },
      items: { min: 1, max: 150 },
    },
  },
  demo: {
    profile: "demo",
    purpose: "Curated multi-role product walkthrough",
    capabilities: DEMO_CAPABILITIES,
    stableIds: ROLE_IDS,
    counts: {
      users: { min: 7, max: 15 },
      projects: { min: 3, max: 30 },
      reports: { min: 2, max: 12 },
      sections: { min: 3, max: 80 },
      items: { min: 5, max: 500 },
    },
  },
  full: {
    profile: "full",
    purpose: "Every shipped product capability family",
    capabilities: FULL_CAPABILITIES,
    stableIds: ROLE_IDS,
    counts: {
      users: { min: 9, max: 30 },
      projects: { min: 12, max: 60 },
      reports: { min: 5, max: 20 },
      sections: { min: 12, max: 200 },
      items: { min: 20, max: 2000 },
    },
  },
  stress: {
    profile: "stress",
    purpose: "Full capability set plus deterministic pagination volume",
    capabilities: [...FULL_CAPABILITIES, "stress-volume"],
    stableIds: ROLE_IDS,
    counts: {
      users: { min: 9, max: 30 },
      projects: { min: 48, max: 60 },
      reports: { min: 5, max: 20 },
      sections: { min: 12, max: 200 },
      items: { min: 100, max: 2000 },
    },
  },
} as const satisfies Record<SeedProfile, SeedProfileManifest>;

export function parseSeedProfile(value: string | undefined): SeedProfile {
  if (
    value !== undefined &&
    (SEED_PROFILES as readonly string[]).includes(value)
  ) {
    return value as SeedProfile;
  }
  const rendered = value === undefined ? "missing" : `"${value}"`;
  throw new Error(
    `Seed profile is ${rendered}. Use exactly one of: ${SEED_PROFILES.join(", ")}.`,
  );
}

export function assertManifestLadder(): void {
  const pairs = [
    ["minimal", "demo"],
    ["demo", "full"],
    ["full", "stress"],
  ] as const satisfies readonly (readonly [SeedProfile, SeedProfile])[];

  const problems = pairs.flatMap(([lower, upper]) => {
    const lowerCapabilities = SEED_PROFILE_MANIFESTS[lower].capabilities;
    const upperCapabilities = new Set(
      SEED_PROFILE_MANIFESTS[upper].capabilities,
    );
    const missing = lowerCapabilities.filter(
      (capability) => !upperCapabilities.has(capability),
    );
    const isStrict = upperCapabilities.size > lowerCapabilities.length;
    return [
      ...missing.map(
        (capability) => `${upper} drops ${lower} capability ${capability}`,
      ),
      ...(isStrict ? [] : [`${upper} is not a strict extension of ${lower}`]),
    ];
  });

  if (problems.length > 0) {
    throw new Error(`Invalid seed profile ladder: ${problems.join("; ")}`);
  }
}
