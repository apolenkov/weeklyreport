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
// Two hardening guards added after the first lead run silently dropped 2 routes
// and emitted colliding ids (see _lead-coverage.md):
//   - CENSUS denominator: a mechanical `find page.tsx` lists every page; Discover
//     must classify each as a role route OR excluded-with-reason, and the script
//     ASSERTS the union covers the census before extract (no silent drops).
//   - ID-UNIQUENESS assert: a deterministic in-script check — an id is the
//     Driver's report key, so a duplicate across routes is a defect the LLM
//     critic cannot see; it gates the repair loop and the final result.
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
      title: "Census",
      detail:
        "1 agent (Haiku) — mechanical `find page.tsx`: the hard route denominator Discover must account for",
      model: "haiku",
    },
    {
      title: "Discover",
      detail:
        "1 agent — classify EVERY census page as a role-reachable route or excluded-with-reason; list the files each route renders",
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

// `args` may arrive as an object OR a JSON string depending on how the runner
// threads it — parse defensively so `{ role }` is always honored (a silent
// fall-through to the "lead" default once regenerated lead instead of viewer).
const parsedArgs =
  typeof args === "string"
    ? (() => {
        try {
          return JSON.parse(args);
        } catch {
          return {};
        }
      })()
    : args || {};
const role = parsedArgs.role || "lead";
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
// Census: the mechanical `find page.tsx` denominator. No judgment — just the list.
const CENSUS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageFiles: { type: "array", items: { type: "string" } },
  },
  required: ["pageFiles"],
};

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
    // Every census page.tsx NOT reachable by this role, each with a one-line
    // reason (guarded away / system-export / auth screen). routes[].pageFile +
    // excludedPages[].pageFile together MUST cover the full census — that union
    // is what the script asserts, so silent drops abort before extract.
    excludedPages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pageFile: { type: "string" },
          reason: { type: "string" },
        },
        required: ["pageFile", "reason"],
      },
    },
    notes: { type: "string" },
  },
  required: ["role", "routes", "excludedPages", "notes"],
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
// Normalize a page-file path to a repo-root-relative "apps/web/src/app/..." key,
// so the census list and Discover's pageFile strings reconcile regardless of
// leading "./", an absolute prefix, or surrounding whitespace.
const normPage = (p) => {
  const s = String(p == null ? "" : p).trim();
  const i = s.indexOf("apps/web/src/app");
  return i >= 0 ? s.slice(i) : s.replace(/^\.\//, "");
};

// Deterministic id-uniqueness check across the whole catalog: an id is the
// Driver's report key, so it MUST be globally unique. The LLM critic cannot be
// trusted for a mechanical set check — this runs in-script. Returns findings as
// "<id> :: <route>, <route>" for each id used on more than one route.
const dupIdFindings = (extr) => {
  const byId = new Map();
  for (const r of extr)
    for (const i of r.intents) {
      const routes = byId.get(i.id) || [];
      routes.push(r.route);
      byId.set(i.id, routes);
    }
  return [...byId.entries()]
    .filter(([, routes]) => new Set(routes).size > 1)
    .map(([id, routes]) => `${id} :: ${[...new Set(routes)].join(", ")}`);
};
const routesOfDup = (finding) =>
  String(finding)
    .split(" :: ")[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
const defectNoteFor = (route, c, dups) => {
  const parts = [];
  if (c.uncoveredRoutes.includes(route))
    parts.push("the route had ZERO intents — extract at least one real intent");
  if (c.structuralLeaks.some((f) => routeOf(f) === route))
    parts.push(
      "an intent leaked a file:line / selector / test name — remove it",
    );
  if (c.vacuousThens.some((f) => routeOf(f) === route))
    parts.push('a "then" was vacuous — make it observable');
  if ((dups || []).some((d) => routesOfDup(d).includes(route)))
    parts.push(
      "an intent id on this route collides with another route — give it a globally unique id, or drop the intent here if that behavior really belongs to the other route",
    );
  return parts.join("; ");
};

// ============================================================================
// ---- Census: the mechanical route denominator ------------------------------
// Discover used to enumerate routes itself and silently dropped some (its own
// list was also the critic's completeness denominator, so the miss was
// invisible). The fix: a mechanical `find` produces the FULL page.tsx list, and
// Discover must account for EVERY entry (route-or-excluded). The script then
// asserts the union covers the census before any extract runs.
phase("Census");
const census = await agent(
  `Run EXACTLY this command and nothing else:
  find apps/web/src/app -name page.tsx
Return every matching path verbatim, one per array entry, repo-root-relative
(each starts with "apps/web/src/app/"). Do NOT filter, judge, sort-away, or omit
any path — this is the mechanical denominator, not a judgment call.`,
  { label: "census", phase: "Census", model: "haiku", schema: CENSUS_SCHEMA },
);
const censusPages = [
  ...new Set((census?.pageFiles || []).map(normPage).filter(Boolean)),
];
if (censusPages.length === 0) {
  log("Census found no page.tsx files — aborting. Check the app path.");
  return { error: "empty census", census };
}
log(`Census: ${censusPages.length} page.tsx files under apps/web/src/app`);

// ---- Discover: classify every census page for THIS role --------------------
phase("Discover");
const disco = await agent(
  `You are the DISCOVER agent for the "${role}" role's Scenario Catalog.

GOAL: classify EVERY page.tsx below as either a route this "${role}" can reach
(-> routes) or one it cannot (-> excludedPages, with a one-line reason). The two
lists TOGETHER must cover every census path — dropping any is a hard error.

CENSUS (the complete page.tsx denominator — account for ALL of these):
${censusPages.map((p) => `  - ${p}`).join("\n")}

HOW (read CODE — do not run the app):
  1. Each segment's access is its SSR layout guard: the
     "REQUIRED: readonly Role[] = [...]" array in the nearest layout.tsx
     (e.g. (app)/lead/layout.tsx, (app)/reports/layout.tsx). A page is reachable
     by "${role}" iff its guard array includes "${role}".
  2. For each census page, resolve its URL route (keep dynamic segments like
     [reportId] as-is; "(app)" and other route groups are NOT URL segments).
     - Reachable by "${role}" (guard includes it, OR it is the public landing
       app/page.tsx "/"): put it in routes. INCLUDE redirect stubs the role can
       reach (e.g. "/", "/lead/history") as routes — a redirect is still a
       reachable behavior worth one intent; do NOT silently fold them into their
       target. Set pageFile to the census path verbatim so it reconciles.
     - NOT reachable (guard excludes the role) OR a system/export/auth view
       (e.g. /print/[reportId], app/auth/error): put it in excludedPages with a
       short reason (e.g. "guarded to [admin] — not ${role}", "system PDF/export
       view", "auth error screen"). Here too, set pageFile to the census path
       verbatim.
  IMPORTANT: every pageFile (routes AND excludedPages) MUST be one of the census
  paths above, copied character-for-character — the script reconciles on it, and
  any census path you neither route nor exclude aborts the whole run.
  3. For each kept route, list readFiles: the page plus the few key components it
     renders that carry the user's ACTIONS (forms, dialogs, tables, primary
     buttons, tRPC mutation call sites). Use a code-graph MCP if present to
     follow imports; otherwise read and follow them.
  4. STABLE IDs: if ${outFile} already exists, READ it. For each route, fill
     priorIntents with the existing {id, intent} pairs found under that route
     (so the extractor can reuse stable ids). If the file does not exist or a
     route is new, priorIntents is [].

Return the structured result (routes + excludedPages). Do NOT write any file.`,
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

// ---- Hard denominator assert: every census page accounted for --------------
const accounted = new Set(
  [
    ...disco.routes.map((r) => r.pageFile),
    ...(disco.excludedPages || []).map((e) => e.pageFile),
  ].map(normPage),
);
const unaccounted = censusPages.filter((p) => !accounted.has(p));
if (unaccounted.length > 0) {
  log(
    `Discover left ${unaccounted.length} census page(s) unaccounted (neither a route nor excluded-with-reason) — aborting before extract: ${unaccounted.join(", ")}`,
  );
  return { error: "unaccounted census pages", unaccounted, role };
}
log(
  `Discover: "${role}" reaches ${disco.routes.length} routes; ${(disco.excludedPages || []).length} pages excluded-with-reason; full census accounted.`,
);

// ---- Extract (one pass) ----------------------------------------------------
phase("Extract");
let extracted = await extractRoutes(disco.routes, null);
await persistCatalog(buildCatalog(extracted));
log(
  `Extract: ${extracted.length}/${disco.routes.length} routes, ${extracted.reduce((n, r) => n + r.intents.length, 0)} intents → ${outFile}`,
);

// ---- Critic + bounded repair ----------------------------------------------
// Two checks gate the loop: the LLM critic (entry-point coverage, structural
// leaks, vacuous thens) AND a deterministic id-uniqueness assert — a duplicate
// id breaks the Driver's report keying and the critic schema cannot see it.
phase("Critic");
let critic = await runCritic();
let dups = dupIdFindings(extracted);
let round = 0;
const pendingDefects = () =>
  (critic ? criticDefects(critic).length : 0) + dups.length;
while (pendingDefects() > 0 && round < MAX_REPAIR) {
  round += 1;
  const criticRoutes = critic ? criticDefects(critic).map(routeOf) : [];
  const flaggedRoutes = [
    ...new Set([...criticRoutes, ...dups.flatMap(routesOfDup)]),
  ];
  const toFix = disco.routes.filter((r) => flaggedRoutes.includes(r.route));
  log(
    `Repair round ${round}/${MAX_REPAIR}: ${toFix.length} flagged route(s) → ${flaggedRoutes.join(", ")}${dups.length ? ` (incl. ${dups.length} id-collision)` : ""}`,
  );
  if (toFix.length === 0) break; // findings didn't map to a known route — stop
  const capturedCritic = critic;
  const capturedDups = dups;
  // Re-extract each flagged route with ITS OWN defect note, via the framework's
  // concurrency-managed parallel() (not Promise.all + nested parallel).
  const repaired = (
    await parallel(
      toFix.map(
        (r) => () =>
          agent(
            extractPrompt(
              r,
              defectNoteFor(r.route, capturedCritic, capturedDups),
            ),
            {
              label: `repair:${r.route}`,
              phase: "Repair",
              model: "haiku",
              schema: EXTRACT_SCHEMA,
            },
          ),
      ),
    )
  ).filter(Boolean);
  // Replace the repaired routes' entries; keep the rest untouched.
  const repairedByRoute = new Map(repaired.map((r) => [r.route, r]));
  extracted = extracted.map((e) => repairedByRoute.get(e.route) || e);
  await persistCatalog(buildCatalog(extracted));
  critic = await runCritic();
  dups = dupIdFindings(extracted);
}

const criticRemaining = critic ? criticDefects(critic) : ["critic did not run"];
const remaining = [...criticRemaining, ...dups.map((d) => `DUPLICATE ID ${d}`)];
if (remaining.length > 0) {
  log(
    `Unresolved after ${round} repair round(s) — left for human review: ${remaining.join("; ")}`,
  );
} else {
  log(`Critic + id-uniqueness clean after ${round} repair round(s).`);
}

return {
  role,
  outFile,
  coverageFile,
  routes: disco.routes.length,
  excludedPages: (disco.excludedPages || []).length,
  intents: extracted.reduce((n, r) => n + r.intents.length, 0),
  repairRounds: round,
  duplicateIds: dups,
  unresolved: remaining,
};
