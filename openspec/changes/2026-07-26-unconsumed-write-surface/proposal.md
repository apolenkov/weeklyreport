# Eleven Write Procedures Nobody Calls

## Why

The mutation-consumer gate has been reporting success on an empty set. Two
independent defects, one behind the other.

**The extractor was dead.** `apps/web/uat-suite/mutation-audit.mjs` counted `{`
and `}` per line to track a namespace stack and matched `^\s*(\w+):\s*router\(\{`
to find namespaces. `trpc.router.ts` has not had that shape since it was split
into seventeen factory functions, so the parser matched nothing:

```
$ pnpm uat:audit --check
mutations: 0, queries: 0
VERIFIED: 0, PARTIAL: 0, BLACK HOLE: 0 (0 unexpected)
[mutation-audit] check passed
```

A blocking gate — `.husky/pre-push` and the CI "Mutation Consumer Audit" job —
green on zero work. Rebuilt on the TypeScript AST it finds 94 procedures, 50 of
them mutations, cross-checked against a text count with the one difference
explained (`searchService.query(...)` is a service call inside a resolver, not a
procedure).

**The classifier was also wrong**, which matters more: fixing only the extractor
would have made the gate look substantive while still deciding nothing. It read

```js
if (hasList || namedConsumer) status = "VERIFIED";
else if (refCount > 0) status = "PARTIAL";
else status = "BLACK HOLE";
```

`refCount` is the number of web files referencing the procedure. It was consulted
only after two heuristics over _sibling query names_ — which never look at the web
app at all. A skeptic demonstrated the consequence rather than arguing it: rename
`saveUser` to `saveUserProfile` on the server, leave the web app calling the old
name, and the gate reports VERIFIED with `refCount: 0`. 43 of 50 mutations sat in
a namespace carrying some `list*` query and could not have been flagged under any
circumstance.

Whether a consumer exists now decides; the heuristics only distinguish "called and
readable back" from "called". With that inversion the gate names **eleven
mutations with no consumer anywhere** — not in `apps/web/src`, not in `e2e/`, not
in `packages/`.

## What The Eleven Are

Each was traced to a decision, not merely observed to be unreferenced.

**An unbuilt admin surface — five procedures.** The whole `projectActivity`
namespace has no client. `git log -S 'projectActivity' -- apps/web/src` is empty
at every commit, so this is not a regression from a removed caller: the surface
was never built. ADR 0012 specifies admin CRUD for activities, ADR 0014 requires
lead attachment to be admin-provisioned, and the live `activity-reporting-unit`
spec puts requirements on schemas that only the server can currently exercise.
`attachLead` and `detachLead` are, outside seeds and tests, the only writers of
`ProjectActivityLead` — so an activity can be put in front of a lead only by
reseeding the database. `archive` is unreachable while `ProjectActivity.archived`
is honored by the read path, meaning activities can be created but never retired.

**A restore path with no button.** `archive.unarchiveReport` has no consumer, and
deletion is foreclosed: archived reports are required to stay restorable.

**Two deliberate retentions.** `admin.testTelegramSend` is a smoke-test producer
for a transport that is deployed but not activated, pinned by a normative scenario.
`admin.saveReminderRule` is a soft-deprecation tombstone whose contract test
asserts it throws `METHOD_NOT_SUPPORTED` — the absence of a consumer is the point.

**Three orphans.** `admin.savePeriod`, `admin.deleteReminderRule` and
`reminders.execute` survive migrations whose other half landed. Nothing pins them
and nothing calls them.

## What Changes

The allowlist records all eleven with the specific reason each is there, and the
stale `carryOver.execute` entry — a namespace that no longer exists — is removed.
That makes the gate green **and** truthful: it now fails on a twelfth.

Allowlisting is deliberately not the end state for nine of them. The three orphans
want deleting and the six missing consumers want building, but both are product
decisions about API surface, not refactoring, so they are recorded here rather
than taken unilaterally in a quality pass.

## Tasks

- [ ] Decide the three orphans: delete `admin.savePeriod`,
      `admin.deleteReminderRule` and `reminders.execute`, or state what keeps them
- [ ] Build the admin Activities tab — create, edit, archive, and a lead-attachment
      editor — modeled on the existing products tab and group-products editor.
      A new admin route trips the catalog-drift gate, so add the
      `e2e/catalog/admin.yaml` scenarios with it
- [ ] Give `archive.unarchiveReport` its restore control
- [ ] Remove each procedure from the allowlist as its consumer lands
- [ ] Revisit the `hasList` heuristic: it now only separates VERIFIED from PARTIAL,
      but 43 of 50 mutations still match it on a namespace coincidence, so PARTIAL
      is close to meaningless. A read-back check should look at what the caller
      actually invalidates, not at sibling names
- [ ] ADR 0012 and 0014 still read "Status: proposed … not yet implemented" while
      their change is archived with every task ticked. Correct the status
