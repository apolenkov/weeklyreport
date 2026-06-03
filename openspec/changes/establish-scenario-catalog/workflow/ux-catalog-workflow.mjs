// ============================================================================
// UX tier — capture the REAL running DOM per role, derive ui-*.feature.
// CustomReport-specific (seed data baked in). Run AFTER the API catalog lands.
//   Workflow({ scriptPath: "/tmp/ux-catalog-workflow.mjs" })
// Requires the dev app already running: web :3000, API :3002, AUTH_DEV_MODE.
// ============================================================================

export const meta = {
  name: "ux-catalog",
  description:
    "Capture live DOM per role (Playwright) and derive UI behavioral scenarios (ui-*.feature) + role x route access matrix",
  phases: [
    {
      title: "Capture",
      detail:
        "4 sequential agents (one per role) drive the browser → /tmp/dom/<role>/*.yml",
    },
    {
      title: "Derive",
      detail: "parallel agents read saved DOM → e2e/catalog/ui-<area>.feature",
    },
    {
      title: "Merge",
      detail: "role x route access matrix → e2e/catalog/_ux-matrix.md",
    },
  ],
};

const BASE = "http://localhost:3000";
const ROLES = [
  { role: "head", email: "head@customreport.local" },
  { role: "lead", email: "dmitry@customreport.local" },
  { role: "admin", email: "admin@customreport.local" },
  { role: "viewer", email: "viewer@customreport.local" },
];
// reportIds: open=current period, published=archived/published period
const OPEN = "a0000000-0000-4000-8000-000000000001";
const PUB = "a0000000-0000-4000-8000-000000000002";
// every role attempts EVERY route — redirects/denials are the UI authz matrix.
const ROUTES = [
  "/",
  "/head/dashboard",
  "/head/history",
  "/head/report",
  `/head/report/${OPEN}`,
  `/head/report/${OPEN}/present`,
  "/head/slides",
  "/lead/report",
  "/lead/history",
  `/lead/report/${OPEN}`,
  `/lead/report/${OPEN}/preview`,
  "/reports",
  "/reports/history",
  "/reports/trends",
  `/reports/${PUB}`,
  `/reports/${PUB}/present`,
  `/print/${PUB}`,
];

const IGNORE = `IGNORE dev-tooling injected into the page — it is NOT app UI:
"Open Next.js Dev Tools", "MCP Connecting...", "Notifications alt+T", any
"Manage MCP & Webhooks" button, React DevTools console line, HMR logs, and the
recharts "width(-1)/height(-1)" warning (a known dev-only noise, not an error).`;

// ---- Phase Capture: one agent per role, SEQUENTIAL (single shared browser) --
phase("Capture");
const CAPTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string" },
    visited: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          route: { type: "string" },
          finalUrl: { type: "string" },
          accessGranted: { type: "boolean" },
          consoleErrorCount: { type: "integer" },
          snapshotFile: { type: "string" },
          mainHeading: { type: "string" },
        },
        required: [
          "route",
          "finalUrl",
          "accessGranted",
          "consoleErrorCount",
          "snapshotFile",
          "mainHeading",
        ],
      },
    },
    notes: { type: "string" },
  },
  required: ["role", "visited", "notes"],
};

const captures = [];
for (const r of ROLES) {
  const cap = await agent(
    `You are a DOM-CAPTURE agent for the "${r.role}" role. Use the Playwright MCP
(load tools via ToolSearch: browser_navigate, browser_snapshot, browser_evaluate
or browser_run_code_unsafe, browser_close).

STEP 1 — login as this role:
  browser_navigate to ${BASE}/auth/dev-login?role=${r.role}&email=${r.email}
  (this sets the session and redirects to the role's home).

STEP 2 — for EACH route below, in order:
${ROUTES.map((x) => `    ${x}`).join("\n")}
  a) browser_navigate to ${BASE}<route>.
  b) WAIT for content to settle — the app shows "Loading…" skeletons first. Wait
     until the main heading/content is real (poll the snapshot, or wait ~3-5s,
     or wait for network idle). Do NOT snapshot a loading skeleton.
  c) browser_snapshot with filename "/tmp/dom/${r.role}/<route-slug>.yml"
     (slug = the route with / -> _ , ids kept). This saves the a11y tree to a file
     — do NOT paste the snapshot back to me; only record the file path.
  d) Record: finalUrl (after any redirect), accessGranted (false if it bounced to
     "/", "/auth/error", a login page, or this role's home instead of the asked
     route — that is an authz denial and is VALUABLE), consoleErrorCount (count
     console entries of level ERROR only — ignore the noise below), and the real
     main <h1> heading text.

${IGNORE}

Be efficient and resilient: if one route errors, record it and move on. Return the
structured manifest for "${r.role}".`,
    {
      label: `capture:${r.role}`,
      phase: "Capture",
      model: "sonnet",
      schema: CAPTURE_SCHEMA,
    },
  );
  if (cap) captures.push(cap);
  log(
    `Capture ${r.role}: ${cap ? cap.visited.length : 0} routes, ${cap ? cap.visited.filter((v) => !v.accessGranted).length : 0} denied`,
  );
}

// ---- Phase Derive: parallel agents per area read saved DOM -> ui-*.feature --
phase("Derive");
const AREAS = [
  { file: "ui-head.feature", label: "Head area", match: "/head/" },
  { file: "ui-lead.feature", label: "Lead area", match: "/lead/" },
  {
    file: "ui-reports.feature",
    label: "Reports/viewer area",
    match: "/reports",
  },
  {
    file: "ui-print-landing.feature",
    label: "Print + landing + cross-role access",
    match: "/print or / or authz",
  },
];
const DERIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    featureFile: { type: "string" },
    scenarioCount: { type: "integer" },
    accessDenialScenarios: { type: "integer" },
    gaps: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: [
    "featureFile",
    "scenarioCount",
    "accessDenialScenarios",
    "gaps",
    "notes",
  ],
};
const manifestJson = JSON.stringify(captures);
const derived = (
  await parallel(
    AREAS.map(
      (a) => () =>
        agent(
          `You are a UX EXTRACT agent. Derive Given/When/Then UI scenarios for: ${a.label}
(routes matching ${a.match}). WRITE FILE: e2e/catalog/${a.file}

INPUTS:
  - Saved DOM accessibility trees under /tmp/dom/<role>/*.yml (read the ones for
    your area; cross-role for the access matrix).
  - The capture manifest (per role, per route: finalUrl, accessGranted,
    consoleErrorCount, mainHeading): ${manifestJson}
  - For API/behavior linkage, the existing e2e/catalog/*.feature (API tier) — link
    a UI action to the procedure it calls where obvious.

RULES (match the API-tier .feature format already in e2e/catalog/):
  - Each Scenario: annotations src(dom)/covered/diff(none)/tier(ui)/code, then
    Given/When/Then.
  - Then MUST be machine-checkable from the DOM: a visible heading/text present,
    a specific element/role present, a control enabled/disabled, OR
    consoleErrorCount == 0. NEVER "page looks right".
  - ACCESS MATRIX (high value): for every (role, route) where accessGranted=false,
    write a negative scenario — "WHEN <role> opens <route> THEN redirected to
    <finalUrl> (access denied)". For accessGranted=true, a positive scenario with
    the real heading.
  - covered: search e2e/**/*.spec.ts for an existing Playwright test asserting it;
    cite file::test:line or mark "none ✗" honestly.
  - tier: ui (these are UI scenarios by definition).
${IGNORE}

Write the .feature, then return the structured summary.`,
          {
            label: `ux-derive:${a.file}`,
            phase: "Derive",
            model: "sonnet",
            schema: DERIVE_SCHEMA,
          },
        ),
    ),
  )
).filter(Boolean);
log(
  `Derive: ${derived.length} ui feature files, ${derived.reduce((n, r) => n + (r.scenarioCount || 0), 0)} UI scenarios`,
);

// ---- Phase Merge: role x route access matrix -------------------------------
phase("Merge");
const matrix = await agent(
  `You are the UX-MATRIX agent. Using this capture manifest:
${manifestJson}
build a ROLE x ROUTE access matrix (rows = routes, columns = head/lead/admin/viewer,
cell = ✓ granted / ✗ denied->finalUrl, plus a console-errors column). Note any route
where a role unexpectedly has access (possible authz leak) or unexpectedly denied.
Write it to e2e/catalog/_ux-matrix.md. Return a short summary.`,
  {
    label: "ux-matrix",
    phase: "Merge",
    model: "sonnet",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        matrixFile: { type: "string" },
        anomalies: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["matrixFile", "anomalies", "notes"],
    },
  },
);

return {
  rolesCaptured: captures.map((c) => ({
    role: c.role,
    routes: c.visited.length,
    denied: c.visited.filter((v) => !v.accessGranted).length,
  })),
  uiFeatures: derived.map((d) => ({
    file: d.featureFile,
    scenarios: d.scenarioCount,
    denials: d.accessDenialScenarios,
  })),
  totalUiScenarios: derived.reduce((n, r) => n + (r.scenarioCount || 0), 0),
  accessAnomalies: matrix ? matrix.anomalies : [],
};
