// ============================================================================
// Shared catalog parser — the single line-scan reader for e2e/catalog/<role>.yaml.
//
// Pure Node, NO dependencies (the repo has no `yaml` package available): a
// line-scan parser scoped to the generator's DETERMINISTIC output format
// (e2e/catalog/README.md + generate-catalog.workflow.mjs `buildCatalog`). It is
// not a general YAML parser; it reads exactly the shape the generator emits.
//
// Consumed by render-checklist.mjs (human-UAT checklist) and catalog-check.mjs
// (the drift gate). Keep it the one source of catalog parsing so both tools see
// the catalog identically.
// ============================================================================

// Inverse of the generator's `yamlStr` (always double-quoted, \\ and \" escaped).
export function unquote(raw) {
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
export function parseCatalog(text) {
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
