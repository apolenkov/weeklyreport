// ============================================================================
// Shared catalog parser — the single line-scan reader for e2e/catalog/<role>.yaml.
//
// Pure Node, NO dependencies (the repo has no `yaml` package available): a
// line-scan parser scoped to the generator's DETERMINISTIC output format
// (e2e/catalog/README.md + generate-catalog.workflow.mjs `buildCatalog`). It is
// not a general YAML parser; it reads exactly the shape the generator emits.
//
// Consumed by render-checklist.ts (human-UAT checklist) and catalog-check.ts
// (the drift gate). Keep it the one source of catalog parsing so both tools see
// the catalog identically.
// ============================================================================

// Mirrors the shared `Role`/`DbRole` union (role-type spec), inline because
// this is a plain-node entrypoint: `tsconfig.scripts.json` empties `paths`, no
// workspace link reaches the root, so the shared import cannot resolve here.
const CANONICAL_ROLES = ["lead", "head", "admin", "viewer"] as const;

type Role = (typeof CANONICAL_ROLES)[number];

const INTENT_FIELDS = ["intent", "given", "when", "then", "note"] as const;

type IntentField = (typeof INTENT_FIELDS)[number];

type Intent = { readonly id: string } & Record<IntentField, string>;

export interface CatalogRoute {
  readonly route: string;
  access: Role[];
  readonly intents: Intent[];
}

export interface Catalog {
  readonly role: Role;
  readonly routes: CatalogRoute[];
}

const isRole = (value: string): value is Role =>
  (CANONICAL_ROLES as readonly string[]).includes(value);

const isIntentField = (value: string): value is IntentField =>
  (INTENT_FIELDS as readonly string[]).includes(value);

// A malformed role token is a corrupt catalog, not a warning: it silently
// produces an empty/wrong access set for every route in the file, which both
// consumers (the blocking drift gate and the human checklist) would then
// render as if the role legitimately has no access anywhere.
function assertValidRole(
  role: string,
  context: string,
): asserts role is Role {
  if (!isRole(role)) {
    throw new Error(
      `Invalid role token "${role}" in ${context} — must be one of: ${CANONICAL_ROLES.join(", ")}`,
    );
  }
}

// Inverse of the generator's `yamlStr` (always double-quoted, \\ and \" escaped).
function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replaceAll(String.raw`\"`, '"')
      .replaceAll("\\\\", "\\");
  }
  return trimmed;
}

const emptyIntent = (id: string): Intent => ({
  id,
  intent: "",
  given: "",
  when: "",
  then: "",
  note: "",
});

const parseRole = (text: string): Role | null => {
  const roleMatch = /^role:\s*(\S+)\s*$/m.exec(text);
  if (!roleMatch?.[1]) return null;
  assertValidRole(roleMatch[1], "top-level role:");
  return roleMatch[1];
};

const parseAccess = (raw: string, route: string): Role[] => {
  const access = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  for (const accessRole of access) {
    assertValidRole(accessRole, `access: [...] for route ${route}`);
  }
  // Every token above went through the assertion, which throws on the first
  // mismatch — the narrowing is runtime-checked, not a raw cast.
  return access as Role[];
};

// Mutable cursor over the two nesting levels the format has. The loop below
// assigns into whichever level the current line belongs to, so the state has to
// outlive one iteration.
interface Cursor { route: CatalogRoute | null; intent: Intent | null }

const consumeLine = (
  line: string,
  cursor: Cursor,
  routes: CatalogRoute[],
): Cursor => {
  const routeMatch = /^\s*-\s*route:\s*(\S+)\s*$/.exec(line);
  if (routeMatch?.[1]) {
    const route = { route: routeMatch[1], access: [], intents: [] };
    routes.push(route);
    return { route, intent: null };
  }
  if (!cursor.route) return cursor;

  const accessMatch = /^\s*access:\s*\[(.*)\]\s*$/.exec(line);
  if (accessMatch?.[1] !== undefined) {
    cursor.route.access = parseAccess(accessMatch[1], cursor.route.route);
    return cursor;
  }

  const idMatch = /^\s*-\s*id:\s*(\S+)\s*$/.exec(line);
  if (idMatch?.[1]) {
    const intent = emptyIntent(idMatch[1]);
    cursor.route.intents.push(intent);
    return { route: cursor.route, intent };
  }

  return applyField(line, cursor);
};

const applyField = (line: string, cursor: Cursor): Cursor => {
  if (!cursor.intent) return cursor;
  // The value capture must start non-blank: `\s*(.*)` lets both halves claim
  // the same run of spaces, and every extra space doubles the ways to split it.
  // An all-blank value is left out, which is what the empty field already is.
  const fieldMatch = /^\s*(intent|given|when|then|note):\s*(\S.*)?$/.exec(line);
  const [, field, raw] = fieldMatch ?? [];
  if (field !== undefined && raw !== undefined && isIntentField(field)) {
    cursor.intent[field] = unquote(raw);
  }
  return cursor;
};

interface Parse {
  cursor: Cursor;
  routes: CatalogRoute[];
}

// Parse the generator's deterministic catalog shape into { role, routes:[{ route,
// access, intents:[{ id, intent, given, when, then, note }] }] }.
export function parseCatalog(text: string): Catalog | null {
  const role = parseRole(text);
  if (!role) return null;

  // The fold carries the collected routes as well as the cursor, so the parse
  // is the reduce's value rather than a side effect on a binding beside it.
  const { routes } = text.split("\n").reduce<Parse>(
    (parse, line) => ({
      cursor: consumeLine(line, parse.cursor, parse.routes),
      routes: parse.routes,
    }),
    { cursor: { route: null, intent: null }, routes: [] },
  );

  return routes.length > 0 ? { role, routes } : null;
}
