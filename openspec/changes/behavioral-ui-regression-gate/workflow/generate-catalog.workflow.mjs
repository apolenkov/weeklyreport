// ============================================================================
// Scenario Catalog generator — durable, behavior-anchored, NOT exhaustive.
//
// Reads CODE (the role's reachable routes + their page/action components + SSR
// guards) and emits a YAML `role x route x intent` catalog with Given/When/Then
// prose. NO file:line, NO selectors, NO test names — those rot on an MVP. DOM is
// the Driver's run-time concern, NEVER the generator's; within-route
// exhaustiveness is the Driver's job (task 3), not this catalog.
//
// Format contract + schema: e2e/catalog/README.md
// Design / rationale:       openspec/changes/behavioral-ui-regression-gate/design.md
//
// Shape (decided in the grill): ONE pass + a BOUNDED repair loop — entry-point
// completeness is a finite checklist (every reachable route has >= 1 intent), so
// loop-until-dry is the wrong tool (that is for unknown-size discovery and would
// drag the catalog toward per-element rot). The critic does not just report; if
// it flags a route (no intent / vacuous "then" / structural leak) the generator
// re-extracts ONLY those routes with the defect noted, up to MAX_REPAIR rounds.
//
// Run it from the repo root:
//   Workflow({ scriptPath: ".../workflow/generate-catalog.workflow.mjs", args: { role: "lead" } })
//
// This is a CODE-reading generator: it does NOT need the dev app running.
// ============================================================================

export const meta = {
  name: "generate-scenario-catalog",
  description:
    "Read a role's reachable routes + page code and emit a durable YAML role x route x intent catalog (no file:line); bounded repair on the entry-point completeness critic",
  whenToUse:
    "Generate or regenerate e2e/catalog/<role>.yaml for the behavioral UI sweep",
  phases: [
    {
      title: "Discover",
      detail:
        "1 agent — list the role's reachable routes (from SSR guards) + the files each route renders",
      model: "sonnet",
    },
    {
      title: "Extract",
      detail:
        "N agents (Haiku) — one per route → the route's durable intents (GWT prose)",
      model: "haiku",
    },
    {
      title: "Critic",
      detail:
        "1 agent — entry-point completeness: every route has >= 1 intent + coverage matrix",
      model: "sonnet",
    },
    {
      title: "Repair",
      detail:
        "Haiku — re-extract ONLY the routes the critic flagged (bounded, <= 2 rounds)",
      model: "haiku",
    },
  ],
};

const role = (args && args.role) || "lead";
const outFile = `e2e/catalog/${role}.yaml`;
const coverageFile = `e2e/catalog/_${role}-coverage.md`;
const MAX_REPAIR = 2;

// What makes the catalog trustworthy — copied verbatim into every extract agent.
const RULES = `
HARD RULES (the format contract — see e2e/catalog/README.md):
  - Anchor to BEHAVIOR, not structure. NO file:line, NO CSS/test selectors, NO
    test names. If an intent can't be phrased without them, it is NOT a durable
    intent — leave it for the Driver's run-time exploration.
  - DURABLE + HIGH-LEVEL, not exhaustive. List the few real user intents on this
    route (what the role comes here to DO), not every button/field/state. A
    typical route has 1-4 intents.
  - Every "then" must be OBSERVABLE: a visible string/heading, a navigation, a
    persisted-then-shown value, or an explicit no-console-error / no-broken-load
    condition. NEVER "it works" / "loads fine".
  - "when" names the action in USER terms ("the lead confirms submission"), never
    a selector. The Driver resolves it to a concrete control at run time.
  - "id" is a stable kebab-slug, prefixed by the role (e.g. "lead-report-submit").
    Keep it stable across regenerations so historical sweep reports stay
    comparable; a genuinely new behavior gets a new id.
`;

// ---- schemas ---------------------------------------------------------------
const DISCOVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string" },
    routes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          route: { type: "string" }, // e.g. "/lead/report/[reportId]"
          access: { type: "array", items: { type: "string" } }, // roles from the SSR layout guard
          pageFile: { type: "string" }, // the page.tsx that renders it
          readFiles: { type: "array", items: { type: "string" } }, // page + key action components to read
          note: { type: "string" }, // e.g. "redirects to role home"
          priorIntents: {
            // existing {id, intent} for this route from a prior catalog (if any);
            // [] when the catalog does not exist yet. Used to reuse stable ids.
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                intent: { type: "string" },
              },
              required: ["id", "intent"],
            },
          },
        },
        required: [
          "route",
          "access",
          "pageFile",
          "readFiles",
          "note",
          "priorIntents",
        ],
      },
    },
    notes: { type: "string" },
  },
  required: ["role", "routes", "notes"],
};

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    route: { type: "string" },
    intents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          intent: { type: "string" },
          given: { type: "string" },
          when: { type: "string" },
          then: { type: "string" },
          note: { type: "string" }, // optional caveat; "" when none
        },
        required: ["id", "intent", "given", "when", "then", "note"],
      },
    },
    notes: { type: "string" },
  },
  required: ["route", "intents", "notes"],
};

const CRITIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    coverageFile: { type: "string" },
    routesTotal: { type: "integer" },
    routesWithIntent: { type: "integer" },
    uncoveredRoutes: { type: "array", items: { type: "string" } }, // route strings
    structuralLeaks: { type: "array", items: { type: "string" } }, // "<route> :: <id>"
    vacuousThens: { type: "array", items: { type: "string" } }, // "<route> :: <id>"
    notes: { type: "string" },
  },
  required: [
    "coverageFile",
    "routesTotal",
    "routesWithIntent",
    "uncoveredRoutes",
    "structuralLeaks",
    "vacuousThens",
    "notes",
  ],
};

// ---- helpers ---------------------------------------------------------------
// Minimal YAML scalar quoting: always double-quote and escape, so prose with
// ':' / '#' / quotes stays valid. Keeps the emitter deterministic.
const yamlStr = (s) =>
  `"${String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

const extractPrompt = (r, defectNote) =>
  `You are an EXTRACT agent for the "${role}" Scenario Catalog.
ROUTE: ${r.route}   (access: ${r.access.join(", ")})
${r.note ? `NOTE: ${r.note}\n` : ""}${defectNote ? `\nFIX THIS DEFECT from the previous pass — ${defectNote}\n` : ""}
Learn what the "${role}" user can DO on this route from these files, then distill
the few DURABLE intents:
${r.readFiles.map((f) => `  - ${f}`).join("\n")}

HOW TO READ — do NOT read linearly. Some of these are large (a form can be ~2000
lines). Navigate to the ACTION SURFACE first: the tRPC mutation call-sites
(\`trpc.*.mutationOptions\` / \`useMutation\`), submit/save/confirm handlers, and
the action components (forms, dialogs, primary buttons). Those call-sites ARE the
intents — a mutation like \`reports.submit\` plus its success toast/state-change
is one intent. Skim the rest for context; don't summarize every line.
${
  r.priorIntents && r.priorIntents.length
    ? `\nSTABLE IDs — this route already exists in the catalog. For an intent that
matches one below in MEANING, REUSE its exact id (so historical sweep reports
stay comparable). Mint a new id ONLY for genuinely new behavior; drop an existing
one only if the behavior is truly gone.
${r.priorIntents.map((p) => `  - ${p.id}: ${p.intent}`).join("\n")}\n`
    : ""
}${RULES}
Return the route's intents (structured). If the route is purely a redirect or a
read-only landing, a single intent describing that is correct — do not invent
actions the code does not offer.`;

const extractRoutes = (routes, defectNote) =>
  parallel(
    routes.map(
      (r) => () =>
        agent(extractPrompt(r, defectNote), {
          label: `${defectNote ? "repair" : "extract"}:${r.route}`,
          phase: defectNote ? "Repair" : "Extract",
          model: "haiku",
          schema: EXTRACT_SCHEMA,
        }),
    ),
  ).then((rs) => rs.filter(Boolean));

const buildCatalog = (extracted) => {
  const routesYaml = extracted
    .map((r) => {
      const meta2 = disco.routes.find((d) => d.route === r.route);
      const access = meta2 ? meta2.access : [];
      const intents = r.intents
        .map((i) => {
          const noteLine = i.note ? `\n        note: ${yamlStr(i.note)}` : "";
          return `      - id: ${i.id}
        intent: ${yamlStr(i.intent)}
        given: ${yamlStr(i.given)}
        when: ${yamlStr(i.when)}
        then: ${yamlStr(i.then)}${noteLine}`;
        })
        .join("\n");
      return `  - route: ${r.route}
    access: [${access.join(", ")}]
    intents:
${intents}`;
    })
    .join("\n");
  const header = `# Scenario Catalog — ${role}
# Durable behavioral catalog (role x route x intent + Given/When/Then prose).
# NO file:line, NOT exhaustive. Generated by generate-catalog.workflow.mjs,
# human-reviewed. Format contract: e2e/catalog/README.md
role: ${role}
generated: true
routes:
`;
  return header + routesYaml + "\n";
};

// The script composes the EXACT bytes (deterministic); a tiny agent persists
// them, since workflow scripts have no filesystem access.
const persistCatalog = (content) =>
  agent(
    `Write this exact content to ${outFile} (create parent dirs if needed). Do not
reformat, reorder, or edit a single character — write it verbatim:

<<<CATALOG
${content}
CATALOG`,
    { label: "persist", phase: "Extract", model: "haiku" },
  );

const runCritic = () =>
  agent(
    `You are the COMPLETENESS CRITIC for the "${role}" Scenario Catalog. Guard
ENTRY POINTS ONLY — do NOT chase per-element completeness (that would re-create
the rotting structural list this design rejects).

INPUTS:
  - The discovered role-reachable routes: ${JSON.stringify(disco.routes.map((r) => r.route))}
  - The generated catalog: ${outFile}

CHECK:
  1. Entry-point completeness: every discovered route has >= 1 intent. List any
     route with zero (uncoveredRoutes — use the exact route string).
  2. Structural leaks: any intent that smuggled in file:line, a CSS/test
     selector, or a test name. List as "<route> :: <id>".
  3. Vacuous "then": any "then" that is not observable ("it works", "loads",
     "page renders"). List as "<route> :: <id>".

Write a coverage matrix (route | intent count | covered?) and the findings to
${coverageFile}. Return the structured summary.`,
    {
      label: "critic",
      phase: "Critic",
      model: "sonnet",
      schema: CRITIC_SCHEMA,
    },
  );

// route part of a "<route> :: <id>" finding (or the bare route for uncovered)
const routeOf = (finding) => String(finding).split(" :: ")[0].trim();
const criticDefects = (c) => [
  ...c.uncoveredRoutes,
  ...c.structuralLeaks,
  ...c.vacuousThens,
];
const defectNoteFor = (route, c) => {
  const parts = [];
  if (c.uncoveredRoutes.includes(route))
    parts.push("the route had ZERO intents — extract at least one real intent");
  if (c.structuralLeaks.some((f) => routeOf(f) === route))
    parts.push(
      "an intent leaked a file:line / selector / test name — remove it",
    );
  if (c.vacuousThens.some((f) => routeOf(f) === route))
    parts.push('a "then" was vacuous — make it observable');
  return parts.join("; ");
};

// ============================================================================
phase("Discover");
const disco = await agent(
  `You are the DISCOVER agent for the "${role}" role's Scenario Catalog.

GOAL: list EVERY route this role can reach, and for each, the files an extract
agent must read to infer the user's intents on that route.

HOW (read CODE — do not run the app):
  1. Routes live under apps/web/src/app/. Authenticated routes are grouped in
     apps/web/src/app/(app)/. Each segment's access is set by its SSR layout
     guard: the "REQUIRED: readonly Role[] = [...]" array in the segment's
     layout.tsx (e.g. (app)/lead/layout.tsx, (app)/reports/layout.tsx). A route
     is reachable by "${role}" iff its guard array includes "${role}".
  2. Enumerate page.tsx files, resolve each to its URL path (keep dynamic
     segments like [reportId] as-is), and KEEP ONLY routes whose guard includes
     "${role}". Also include "/" (it redirects to the role home).
  3. EXCLUDE routes guarded away from this role, and system/export views like
     /print/[reportId].
  4. For each kept route, list pageFile (the page.tsx) and readFiles: the page
     plus the few key components it renders that carry the user's ACTIONS (forms,
     dialogs, tables, primary buttons, tRPC mutation call sites). Use a
     code-graph MCP if present to follow imports; otherwise read and follow them.
  5. STABLE IDs: if ${outFile} already exists, READ it. For each route, fill
     priorIntents with the existing {id, intent} pairs found under that route
     (so the extractor can reuse stable ids). If the file does not exist or a
     route is new, priorIntents is [].

Return the structured route list. Do NOT write any file.`,
  {
    label: "discover",
    phase: "Discover",
    model: "sonnet",
    schema: DISCOVER_SCHEMA,
  },
);

if (!disco || !disco.routes || disco.routes.length === 0) {
  log("Discover found no routes — aborting. Check the role name and guards.");
  return { error: "no routes", disco };
}
log(`Discover: "${role}" reaches ${disco.routes.length} routes`);

// ---- Extract (one pass) ----------------------------------------------------
phase("Extract");
let extracted = await extractRoutes(disco.routes, null);
await persistCatalog(buildCatalog(extracted));
log(
  `Extract: ${extracted.length}/${disco.routes.length} routes, ${extracted.reduce((n, r) => n + r.intents.length, 0)} intents → ${outFile}`,
);

// ---- Critic + bounded repair ----------------------------------------------
phase("Critic");
let critic = await runCritic();
let round = 0;
while (critic && criticDefects(critic).length > 0 && round < MAX_REPAIR) {
  round += 1;
  const flaggedRoutes = [...new Set(criticDefects(critic).map(routeOf))];
  const toFix = disco.routes.filter((r) => flaggedRoutes.includes(r.route));
  log(
    `Repair round ${round}/${MAX_REPAIR}: ${toFix.length} flagged route(s) → ${flaggedRoutes.join(", ")}`,
  );
  if (toFix.length === 0) break; // findings didn't map to a known route — stop
  const captured = critic;
  // Re-extract each flagged route with ITS OWN defect note, via the framework's
  // concurrency-managed parallel() (not Promise.all + nested parallel).
  const repaired = (
    await parallel(
      toFix.map(
        (r) => () =>
          agent(extractPrompt(r, defectNoteFor(r.route, captured)), {
            label: `repair:${r.route}`,
            phase: "Repair",
            model: "haiku",
            schema: EXTRACT_SCHEMA,
          }),
      ),
    )
  ).filter(Boolean);
  // Replace the repaired routes' entries; keep the rest untouched.
  const repairedByRoute = new Map(
    repaired.filter(Boolean).map((r) => [r.route, r]),
  );
  extracted = extracted.map((e) => repairedByRoute.get(e.route) || e);
  await persistCatalog(buildCatalog(extracted));
  critic = await runCritic();
}

const remaining = critic ? criticDefects(critic) : ["critic did not run"];
if (remaining.length > 0) {
  log(
    `Critic still flags ${remaining.length} item(s) after ${round} repair round(s) — left for human review: ${remaining.join("; ")}`,
  );
} else {
  log(`Critic clean after ${round} repair round(s).`);
}

return {
  role,
  outFile,
  coverageFile,
  routes: disco.routes.length,
  intents: extracted.reduce((n, r) => n + r.intents.length, 0),
  repairRounds: round,
  unresolved: remaining,
};
