// ============================================================================
// Human-Driver mode — render the durable Scenario Catalog as a per-role
// manual-UAT checklist.
//
// The catalog (e2e/catalog/<role>.yaml) drives two Driver modes that share one
// report shape: the AI agent sweep (catalog-sweep.spec.ts) and THIS human
// checklist. A human reviewer walks each role's routes/intents and records
// pass/fail + notes — the same findings shape the automated sweep produces, so
// manual-UAT findings feed back into the catalog (the intake loop in
// e2e/catalog/README.md).
//
// Pure Node, NO dependencies. Catalog parsing is shared with the drift gate via
// catalog-parser.ts (one line-scan reader for the generator's deterministic
// format — see e2e/catalog/README.md).
//
// Run from the repo root:
//   node e2e/sweep/render-checklist.ts
// Writes e2e/sweep/.reports/checklist-<role>.md per catalog found.
// ============================================================================
import * as fs from "node:fs";
import * as path from "node:path";

import { type CatalogRoute, parseCatalog } from "./catalog-parser.ts";
import { byName } from "./ordering.ts";

const HERE = import.meta.dirname;
const CATALOG_DIR = path.resolve(HERE, "..", "catalog");
const REPORT_DIR = path.resolve(HERE, ".reports");

const countIntents = (routes: readonly CatalogRoute[]): number =>
  routes.reduce((n, r) => n + r.intents.length, 0);

const renderIntents = (route: CatalogRoute): readonly string[] =>
  route.intents.flatMap((i) => [
    `- [ ] **${i.intent}** \`(${i.id})\``,
    ...(i.given ? [`  - given: ${i.given}`] : []),
    ...(i.when ? [`  - when: ${i.when}`] : []),
    ...(i.then ? [`  - then: ${i.then}`] : []),
    ...(i.note ? [`  - note: ${i.note}`] : []),
    `  - result: PASS / FAIL — _notes:_`,
  ]);

const renderRoute = (route: CatalogRoute): readonly string[] => [
  `## ${route.route}`,
  ...(route.access.length > 0 ? [`access: ${route.access.join(", ")}`] : []),
  "",
  ...(route.intents.length === 0
    ? ["- (no intents — investigate)", ""]
    : [...renderIntents(route), ""]),
];

function renderChecklist(role: string, routes: readonly CatalogRoute[]): string {
  const header = [
    `# Manual UAT checklist — ${role}`,
    "",
    `Human-Driver mode for the behavioral UI sweep. Source catalog: ` +
      `\`e2e/catalog/${role}.yaml\`. Walk each route, perform each intent's ` +
      `**when** from its **given**, and confirm the **then**. Record the result.`,
    "",
    `**${routes.length} routes · ${countIntents(routes)} intents.** Result legend: ` +
      "`[ ]` pass · `[x]` checked/visited · mark FAIL inline with a note. " +
      "Confirmed failures graduate back into the catalog (intake loop).",
    "",
  ];
  return [...header, ...routes.flatMap(renderRoute)].join("\n");
}

function main(): void {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`No catalog dir at ${CATALOG_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const catalogs = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort(byName);
  if (catalogs.length === 0) {
    console.error("No <role>.yaml catalogs found.");
    process.exit(1);
  }
  for (const file of catalogs) {
    const parsed = parseCatalog(
      fs.readFileSync(path.join(CATALOG_DIR, file), "utf8"),
    );
    if (!parsed) {
      console.warn(`skip ${file}: no role/routes parsed`);
      continue;
    }
    const out = path.join(REPORT_DIR, `checklist-${parsed.role}.md`);
    fs.writeFileSync(out, renderChecklist(parsed.role, parsed.routes), "utf8");
    console.log(
      `checklist ${parsed.role}: ${parsed.routes.length} routes, ${countIntents(parsed.routes)} intents → ${path.relative(process.cwd(), out)}`,
    );
  }
}

main();
