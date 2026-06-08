export const meta = {
  name: "sc-catalog-iter3",
  description:
    "Close round-2 gaps: /admin UX capture, WorkingDays + PdfExportStatus.processing, then round-3 convergence critic",
  phases: [
    {
      title: "Fill",
      detail:
        "admin UX capture+derive (Playwright) || WorkingDays + dead-enum gap-fill",
    },
    { title: "Critic", detail: "round-3 convergence → _gaps-round3.md" },
  ],
};

const BASE = "http://localhost:3000";
const ROLES = [
  { role: "admin", email: "admin@customreport.local" },
  { role: "head", email: "head@customreport.local" },
  { role: "lead", email: "dmitry@customreport.local" },
  { role: "viewer", email: "viewer@customreport.local" },
];
const ADMIN_ROUTES = ["/admin", "/admin/products", "/admin/settings"];

phase("Fill");

const adminCapture = () =>
  agent(
    `You are a UX capture+derive agent for the /admin route tree (missed by the first
UX pass). Use the Playwright MCP (load via ToolSearch: browser_navigate,
browser_snapshot, browser_close).

For EACH role below, login via ${BASE}/auth/dev-login?role=<role>&email=<email>, then
visit each /admin route; WAIT for content to settle (not the loading skeleton) before
snapshotting to /tmp/dom/<role>/admin_<slug>.yml. Record finalUrl, accessGranted
(false if bounced to role home / in-page wall), consoleErrorCount (ERROR level only),
and the real <h1>.
  roles: ${ROLES.map((r) => `${r.role}=${r.email}`).join(", ")}
  routes: ${ADMIN_ROUTES.join(", ")}
IGNORE dev-tooling in the DOM (Next DevTools, "MCP Connecting", Notifications,
recharts width(-1) warning, React DevTools console line, HMR).

Then WRITE e2e/catalog/ui-admin.feature in the SAME Given/When/Then format as the
other e2e/catalog/ui-*.feature files (annotations src(dom)/covered/diff(none)/tier(ui)/
code; machine-checkable Then = visible heading/element present or consoleErrorCount==0;
for each role denied on a route, a negative access scenario "WHEN <role> opens <route>
THEN redirected to <finalUrl>"). Link admin UI actions to the admin.* procedures they
call where obvious (cross-ref e2e/catalog/admin.feature). covered: cite a real
e2e/*.spec.ts test or "none ✗" — never fabricate.

Return: {featureFile, scenarioCount, deniedCount, anomalies[], notes}.`,
    {
      label: "ux:admin",
      phase: "Fill",
      model: "sonnet",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          featureFile: { type: "string" },
          scenarioCount: { type: "integer" },
          deniedCount: { type: "integer" },
          anomalies: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
        required: [
          "featureFile",
          "scenarioCount",
          "deniedCount",
          "anomalies",
          "notes",
        ],
      },
    },
  );

const fillGaps = () =>
  agent(
    `You are closing two round-2 catalog gaps (see e2e/catalog/_gaps-round2.md). Match
the existing e2e/catalog/*.feature format (read reports-period.feature + carry-over.feature
first). Machine-checkable Then; honest covered marks (cite real test in apps/**/*.test.ts
or "none ✗"); add # code: lines verified by reading the files.

GAP A — WorkingDays drives the deadline (live, zero catalog presence). Code:
apps/api/src/lib/business-date.ts::computeDeadline takes a WorkingDays policy
("mon-fri" | "mon-sat" | "mon-sun"); call sites pass the STORED settings.workingDays
(admin.createPeriodManual + the period-creator cron), so the policy genuinely changes
the computed deadline in v1 (the schema comment claiming otherwise is stale). READ
business-date.ts to get exact semantics, then add 3 scenarios (one per policy value)
asserting the computed deadline differs as expected — e.g. a Friday+1-business-day
deadline lands on Monday under mon-fri but Saturday under mon-sat. Put them in
reports-period.feature (period/deadline area) or misc.feature, whichever fits;
search apps/**/business-date*.test.ts for existing coverage to mark covered honestly.

GAP B — PdfExportStatus.processing is a DEAD value (mapper declares it; no production
path writes it — service writes queued/completed, processor calls markExportFailed/
markExportCompleted). Add ONE scenario in misc.feature (pdfExport area) marking
"processing" as a dead/unreachable enum value, exactly like CarryOverStatus.failed is
marked dead in carry-over.feature:113-120. READ pdf-export.service.ts +
pdf-export.processor.ts to confirm before writing.

Append via Edit (do not rewrite files; do not touch unrelated scenarios). No new deps.
Return: {filesEdited[], scenariosAdded, notes}.`,
    {
      label: "fill:workingdays+pdf",
      phase: "Fill",
      model: "sonnet",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          filesEdited: { type: "array", items: { type: "string" } },
          scenariosAdded: { type: "integer" },
          notes: { type: "string" },
        },
        required: ["filesEdited", "scenariosAdded", "notes"],
      },
    },
  );

const [cap, fill] = await parallel([adminCapture, fillGaps]);
log(
  `Fill: ui-admin ${cap ? cap.scenarioCount : 0} scenarios (${cap ? cap.deniedCount : 0} denied); gap-fill +${fill ? fill.scenariosAdded : 0} scenarios`,
);

phase("Critic");
const critic = await agent(
  `You are the ROUND-3 convergence gap-critic for the e2e/catalog/ behavioral catalog.
Rounds 1+2 findings are in _gaps.md, _gaps-round2.md, _ux-findings.md — do NOT repeat
them. Round-2 left exactly three open items now addressed: /admin UX (ui-admin.feature),
WorkingDays scenarios, PdfExportStatus.processing dead-marker. Verify those three ARE
now present and adequate, then sweep for any genuinely NEW gap (entry-point parity,
enum-state parity, UX/API linkage, machine-checkability) across the WHOLE catalog
(API + UX including ui-admin). Use codegraph to confirm reachability. Write
e2e/catalog/_gaps-round3.md with ONLY new findings or "CONVERGED". Do not edit .feature
files. Return: {newEntryPointGaps, newEnumGaps, newLinkageGaps, newCheckabilityViolations, verdict}.`,
  {
    label: "critic:round3",
    phase: "Critic",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        newEntryPointGaps: { type: "integer" },
        newEnumGaps: { type: "integer" },
        newLinkageGaps: { type: "integer" },
        newCheckabilityViolations: { type: "integer" },
        verdict: { type: "string" },
        notes: { type: "string" },
      },
      required: [
        "newEntryPointGaps",
        "newEnumGaps",
        "newLinkageGaps",
        "newCheckabilityViolations",
        "verdict",
        "notes",
      ],
    },
  },
);

return {
  uiAdmin: cap
    ? {
        scenarios: cap.scenarioCount,
        denied: cap.deniedCount,
        anomalies: cap.anomalies,
      }
    : null,
  gapFill: fill
    ? { files: fill.filesEdited, added: fill.scenariosAdded }
    : null,
  round3: critic
    ? {
        verdict: critic.verdict,
        newEntryPointGaps: critic.newEntryPointGaps,
        newEnumGaps: critic.newEnumGaps,
        newLinkageGaps: critic.newLinkageGaps,
        newCheckabilityViolations: critic.newCheckabilityViolations,
      }
    : null,
};
