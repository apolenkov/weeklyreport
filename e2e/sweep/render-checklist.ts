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
// Writes manual-uat/checklist-<role>.md under the external archive.
// ============================================================================
import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Catalog,
  type CatalogRoute,
  parseCatalog,
} from "./catalog-parser.ts";
import { byName } from "./ordering.ts";

const HERE = import.meta.dirname;
const CATALOG_DIR = path.resolve(HERE, "..", "catalog");
export const checklistReportDirectory = (
  archiveRoot = process.env.CUSTOMREPORT_ARCHIVE_DIR,
  home = homedir(),
): string =>
  path.join(
    archiveRoot ?? path.join(home, "work", "customreport-archive"),
    "manual-uat",
  );

export const requireCatalog = (source: string, file: string): Catalog => {
  const parsed = parseCatalog(source);
  if (parsed === null)
    throw new Error(`Invalid catalog ${file}: no role/routes parsed`);
  return parsed;
};

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

function renderChecklist(
  role: string,
  routes: readonly CatalogRoute[],
): string {
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
  const reportDir = checklistReportDirectory();
  fs.mkdirSync(reportDir, { recursive: true });
  const catalogs = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort(byName);
  if (catalogs.length === 0) {
    console.error("No <role>.yaml catalogs found.");
    process.exit(1);
  }
  for (const file of catalogs) {
    const parsed = requireCatalog(
      fs.readFileSync(path.join(CATALOG_DIR, file), "utf8"),
      file,
    );
    const out = path.join(reportDir, `checklist-${parsed.role}.md`);
    fs.writeFileSync(out, renderChecklist(parsed.role, parsed.routes), "utf8");
    console.log(
      `checklist ${parsed.role}: ${parsed.routes.length} routes, ${countIntents(parsed.routes)} intents → ${path.relative(process.cwd(), out)}`,
    );
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main();
