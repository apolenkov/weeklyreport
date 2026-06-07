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
// Pure Node, NO dependencies (the repo has no `yaml` package available): a
// line-scan parser scoped to the generator's DETERMINISTIC output format
// (e2e/catalog/README.md + generate-catalog.workflow.mjs `buildCatalog`). It is
// not a general YAML parser; it reads exactly the shape the generator emits.
//
// Run from the repo root:
//   node e2e/sweep/render-checklist.mjs
// Writes e2e/sweep/.reports/checklist-<role>.md per catalog found.
// ============================================================================
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.resolve(HERE, "..", "catalog");
const REPORT_DIR = path.resolve(HERE, ".reports");

// Inverse of the generator's `yamlStr` (always double-quoted, \\ and \" escaped).
function unquote(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

// Parse the generator's deterministic catalog shape into { role, routes:[{ route,
// access, intents:[{ id, intent, given, when, then, note }] }] }.
function parseCatalog(text) {
  const lines = text.split("\n");
  const roleMatch = /^role:\s*(\S+)\s*$/m.exec(text);
  if (!roleMatch) return null;
  const role = roleMatch[1];

  const routes = [];
  let route = null;
  let intent = null;
  for (const line of lines) {
    const routeMatch = /^\s*-\s*route:\s*(\S+)\s*$/.exec(line);
    if (routeMatch) {
      route = { route: routeMatch[1], access: [], intents: [] };
      routes.push(route);
      intent = null;
      continue;
    }
    if (!route) continue;

    const accessMatch = /^\s*access:\s*\[(.*)\]\s*$/.exec(line);
    if (accessMatch) {
      route.access = accessMatch[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }
    const idMatch = /^\s*-\s*id:\s*(\S+)\s*$/.exec(line);
    if (idMatch) {
      intent = {
        id: idMatch[1],
        intent: "",
        given: "",
        when: "",
        then: "",
        note: "",
      };
      route.intents.push(intent);
      continue;
    }
    if (!intent) continue;
    const fieldMatch = /^\s*(intent|given|when|then|note):\s*(.*)$/.exec(line);
    if (fieldMatch) {
      intent[fieldMatch[1]] = unquote(fieldMatch[2]);
    }
  }
  return routes.length > 0 ? { role, routes } : null;
}

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
