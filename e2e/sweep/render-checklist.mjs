// ============================================================================
// Human-Driver mode (task 3.2) — render the durable Scenario Catalog as a
// per-role manual-UAT checklist.
//
// The catalog (e2e/catalog/<role>.yaml) drives two Driver modes that share one
// report shape: the AI agent sweep (catalog-sweep.spec.ts, task 3.1/Layer-1)
// and THIS human checklist. A human reviewer walks each role's routes/intents
// and records pass/fail + notes — the same findings shape the automated sweep
// produces, so manual-UAT findings feed back into the catalog (the intake loop
// in e2e/catalog/README.md).
//
// Pure Node, NO dependencies. Catalog parsing is shared with the drift gate via
// catalog-parser.mjs (one line-scan reader for the generator's deterministic
// format — see e2e/catalog/README.md).
//
// Run from the repo root:
//   node e2e/sweep/render-checklist.mjs
// Writes e2e/sweep/.reports/checklist-<role>.md per catalog found.
// ============================================================================
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCatalog } from "./catalog-parser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.resolve(HERE, "..", "catalog");
const REPORT_DIR = path.resolve(HERE, ".reports");

function renderChecklist(role, routes) {
  const intentCount = routes.reduce((n, r) => n + r.intents.length, 0);
  const lines = [
    `# Manual UAT checklist — ${role}`,
    "",
    `Human-Driver mode for the behavioral UI sweep. Source catalog: ` +
      `\`e2e/catalog/${role}.yaml\`. Walk each route, perform each intent's ` +
      `**when** from its **given**, and confirm the **then**. Record the result.`,
    "",
    `**${routes.length} routes · ${intentCount} intents.** Result legend: ` +
      "`[ ]` pass · `[x]` checked/visited · mark FAIL inline with a note. " +
      "Confirmed failures graduate back into the catalog (intake loop).",
    "",
  ];
  for (const r of routes) {
    lines.push(`## ${r.route}`);
    if (r.access.length > 0) lines.push(`access: ${r.access.join(", ")}`);
    lines.push("");
    if (r.intents.length === 0) {
      lines.push("- (no intents — investigate)", "");
      continue;
    }
    for (const i of r.intents) {
      lines.push(`- [ ] **${i.intent}** \`(${i.id})\``);
      if (i.given) lines.push(`  - given: ${i.given}`);
      if (i.when) lines.push(`  - when: ${i.when}`);
      if (i.then) lines.push(`  - then: ${i.then}`);
      if (i.note) lines.push(`  - note: ${i.note}`);
      lines.push(`  - result: PASS / FAIL — _notes:_`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`No catalog dir at ${CATALOG_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const catalogs = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
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
    const intents = parsed.routes.reduce((n, r) => n + r.intents.length, 0);
    console.log(
      `checklist ${parsed.role}: ${parsed.routes.length} routes, ${intents} intents → ${path.relative(process.cwd(), out)}`,
    );
  }
}

main();
