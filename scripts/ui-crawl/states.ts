import assert from "node:assert/strict";

export const CRAWL_STATES = [
  "draft",
  "submitted",
  "returned",
  "published",
  "archived",
  "closed",
  "reopened",
] as const;

export type CrawlState = (typeof CRAWL_STATES)[number];

// Stable canonical seed identities, also checked by the preparing CLI.
export const CRAWL_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
export const CRAWL_AUTHOR_ID = "a0000000-0000-4000-8000-000000000011";

interface StateMetadata {
  readonly description: string;
  readonly tuple: readonly [string, string, boolean, string];
  readonly sectionStatus: "draft" | "submitted";
}

const CRAWL_STATE_META = {
  draft: {
    description: "Open report; primary Lead has an editable draft",
    tuple: ["open", "draft", false, "open"],
    sectionStatus: "draft",
  },
  submitted: {
    description: "Open report; primary Lead has submitted their section",
    tuple: ["open", "draft", false, "open"],
    sectionStatus: "submitted",
  },
  returned: {
    description:
      "Open report; current changes-requested verdict returned the primary section to draft",
    tuple: ["open", "draft", false, "open"],
    sectionStatus: "draft",
  },
  published: {
    description: "Published report with a populated immutable snapshot",
    tuple: ["published", "published", false, "published"],
    sectionStatus: "submitted",
  },
  archived: {
    description:
      "Archived publication retaining its populated immutable snapshot",
    tuple: ["archived", "published", true, "published"],
    sectionStatus: "submitted",
  },
  closed: {
    // There is no closed enum or close-period command. This legal archive
    // transition closes an unpublished period, exercising period_closed.
    description:
      "Unpublished period closed by archive; archived draft, without a publication snapshot",
    tuple: ["archived", "draft", true, "open"],
    sectionStatus: "draft",
  },
  reopened: {
    description:
      "Previously published report reopened; live drafts retain the prior frozen snapshot",
    tuple: ["open", "published", false, "reopened"],
    sectionStatus: "draft",
  },
} as const satisfies Record<CrawlState, StateMetadata>;

export interface CrawlStateManifest {
  readonly version: 1;
  readonly state: CrawlState;
  readonly seedProfile: "full";
  readonly target: {
    readonly database: string;
    readonly host: string;
    readonly port: string;
  };
  readonly targetUrl: string;
  readonly reportId: string;
  readonly sectionId: string;
  readonly authorId: string;
  readonly preparedAt: string;
  readonly observed: {
    readonly periodState: string;
    readonly status: string;
    readonly periodStatus: string;
    readonly archived: boolean;
    readonly sectionStatus: string;
    readonly sectionVersion: number;
    readonly hasPublishedSnapshot: boolean;
    readonly reviewVerdict: string | null;
    readonly reviewComment: string | null;
  };
  readonly specs: readonly string[];
}

export function parseCrawlState(value: string | undefined): CrawlState {
  assert(
    value !== undefined && (CRAWL_STATES as readonly string[]).includes(value),
    `Crawl state must be one of: ${CRAWL_STATES.join(", ")}`,
  );
  return value as CrawlState;
}

function asObject(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function validateTarget(value: unknown, targetUrl: unknown): void {
  const target = asObject(value);
  assert.equal(typeof target.database, "string");
  assert.equal(typeof target.host, "string");
  assert.equal(typeof target.port, "string");
  assert.equal(typeof targetUrl, "string");
  const url = new URL(String(targetUrl));
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.username, "***");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(url.pathname, `/${String(target.database)}`);
  assert.equal(url.hostname, target.host);
  assert.equal(url.port, target.port);
  assert.match(
    String(target.database),
    /^customreport_e2e(?:_lane_[ab]_test)?$/u,
  );
  assert(["127.0.0.1", "localhost", "[::1]"].includes(String(target.host)));
}

function validateObserved(value: unknown, state: CrawlState): void {
  const observed = asObject(value);
  const expected = CRAWL_STATE_META[state];
  assert.deepEqual(
    [
      observed.periodState,
      observed.status,
      observed.archived,
      observed.periodStatus,
    ],
    expected.tuple,
    "The manifest lifecycle does not match the requested crawl state",
  );
  assert.equal(observed.sectionStatus, expected.sectionStatus);
  assert(Number.isSafeInteger(observed.sectionVersion));
  assert(Number(observed.sectionVersion) > 0);
  assert.equal(
    observed.hasPublishedSnapshot,
    expected.tuple[1] === "published",
  );
  if (state === "returned") {
    assert.equal(observed.reviewVerdict, "changes_requested");
    assert.equal(typeof observed.reviewComment, "string");
    assert(String(observed.reviewComment).trim().length > 0);
  } else {
    assert.equal(observed.reviewVerdict, null);
    assert.equal(observed.reviewComment, null);
  }
}

/** A supplied state name cannot stand in for a validated database read-back. */
export function readStateManifest(
  value: unknown,
  expectedState?: CrawlState,
): CrawlStateManifest {
  const manifest = asObject(value);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.seedProfile, "full");
  const state = parseCrawlState(String(manifest.state));
  if (expectedState !== undefined) assert.equal(state, expectedState);
  assert.equal(manifest.reportId, CRAWL_REPORT_ID);
  assert.equal(manifest.authorId, CRAWL_AUTHOR_ID);
  assert.match(
    String(manifest.sectionId),
    /^a0000000-0000-4000-8000-[0-9a-f]{12}$/u,
  );
  assert.equal(typeof manifest.preparedAt, "string");
  assert(Number.isFinite(Date.parse(String(manifest.preparedAt))));
  assert(Array.isArray(manifest.specs) && manifest.specs.length > 0);
  assert(manifest.specs.every((spec: unknown) => typeof spec === "string"));
  validateTarget(manifest.target, manifest.targetUrl);
  validateObserved(manifest.observed, state);
  return manifest as unknown as CrawlStateManifest;
}

const ADMIN_TABS = [
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
const TRENDS_PATH = "/reports/trends";

/** Explicit entries prevent UUID collapsing or link discovery from hiding a state. */
export function stateEntryPaths(
  role: string,
  state: CrawlState,
): readonly string[] {
  const archive =
    state === "archived" || state === "closed" ? "?archive=1" : "";
  const report = `${CRAWL_REPORT_ID}${archive}`;
  if (role === "admin") {
    return [...ADMIN_TABS.map((tab) => `/admin?tab=${tab}`), "/pdf-exports"];
  }
  if (role === "head") {
    return [
      "/head/dashboard",
      `/head/report/${report}`,
      "/reports",
      TRENDS_PATH,
      "/pdf-exports",
    ];
  }
  if (role === "lead") {
    return [
      `/lead/report/${report}`,
      `/lead/report/${CRAWL_REPORT_ID}/preview${archive}`,
      "/reports",
      TRENDS_PATH,
    ];
  }
  assert.equal(role, "viewer", "Unknown crawl role");
  // An unpublished archived period is inaccessible to Viewer. Status must
  // resolve to the previous publication; preserve that observable denial.
  return ["/reports/latest", `/reports/${report}`, "/reports", TRENDS_PATH];
}
