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

**Three deliberate retentions.** `admin.testTelegramSend` is a smoke-test producer
for a transport that is deployed but not activated, pinned by a normative scenario.
`admin.saveReminderRule` and `admin.deleteReminderRule` are soft-deprecation
tombstones whose contract tests assert they throw `METHOD_NOT_SUPPORTED` and never
reach the service — the absence of a consumer is the point. `deleteReminderRule`
was first written up below as an orphan, on a reading that predates the commit
turning it into a tombstone; it belongs here instead.

**Two orphans.** `admin.savePeriod` and `reminders.execute` survive migrations
whose other half landed. Nothing pins them and nothing calls them.

## What Changes

The allowlist records all eleven with the specific reason each is there, and the
stale `carryOver.execute` entry — a namespace that no longer exists — is removed.
That makes the gate green **and** truthful: it now fails on a twelfth.

Allowlisting is deliberately not the end state for eight of them. The two orphans
want deleting and the six missing consumers want building, but both are product
decisions about API surface, not refactoring, so they are recorded here rather
than taken unilaterally in a quality pass.

## Tasks

- [x] Decide the three orphans. `admin.savePeriod` and `reminders.execute` are
      deleted, along with the service, repository and query methods that became
      unreachable. `admin.deleteReminderRule` is kept: it is a tombstone, not an
      orphan, and its allowlist entry now says so
- [x] Build the admin Activities tab — create, edit, archive, and a lead-attachment
      editor — modeled on the existing products tab and group-products editor.
      A new admin route trips the catalog-drift gate, so add the
      `e2e/catalog/admin.yaml` scenarios with it. Confirmed: the tab exists
      (`apps/web/src/app/(app)/admin/activities`, `activities-tab.tsx`,
      `activity-edit-dialog.tsx`, `activity-leads-editor.tsx`), wired to
      `projectActivity.create/update/archive/attachLead/detachLead`; catalog
      scenarios are present (`e2e/catalog/admin.yaml:62-168`, routes
      `admin-activities-manage` / `admin-activities-view`) and
      `pnpm catalog:check` is green.
- [x] Give `archive.unarchiveReport` its restore control. Restore sits beside
      Archive in the head report toolbar; the weekly read model now carries
      `archived`, which is what tells the two states apart, and its allowlist
      entry is removed. Confirmed: `archive-restore-actions.tsx` wires the
      control into `weekly-report-page.tsx`; the allowlist has no
      `archive.unarchiveReport` entry.
- [x] Remove each procedure from the allowlist as its consumer lands.
      Confirmed: `apps/web/uat-suite/mutation-audit.allowlist.json` now holds
      exactly the 3 deliberate retentions (`testTelegramSend`,
      `saveReminderRule`, `deleteReminderRule`) — no stale `carryOver.execute`,
      no `projectActivity.*` entries, no `archive.unarchiveReport`. Running
      `pnpm uat:audit --check` reports `BLACK HOLE: 3 (0 unexpected)`, and
      `mutation-audit.md` lists all five `projectActivity.*` procedures plus
      `archive.unarchiveReport` as VERIFIED (lines 78, 85-89) with real
      `invalidateQueries` read-backs.
- [x] Revisit the `hasList` heuristic: it now only separates VERIFIED from PARTIAL,
      but 43 of 50 mutations still match it on a namespace coincidence, so PARTIAL
      is close to meaningless. A read-back check should look at what the caller
      actually invalidates, not at sibling names. Confirmed: `hasList` no
      longer appears anywhere in `apps/web/uat-suite`; classification now runs
      through `auditReadBack` in `read-back-analysis.mjs`, which inspects each
      call site's actual `invalidateQueries(...)` calls. The discriminating
      evidence is the count shift: a plain run now reports
      `VERIFIED: 41, PARTIAL: 2, UNRESOLVED: 2, BLACK HOLE: 3` — PARTIAL down
      from ~43 to 2, with the ambiguous cases broken out into a new
      UNRESOLVED bucket instead of being silently folded into VERIFIED or
      PARTIAL.
- [x] ADR 0012 and 0014 still read "Status: proposed … not yet implemented" while
      their change is archived with every task ticked. Correct the status.
      Done: both now read `**Status:** accepted (locked via the demo-feedback
grill on 2026-06-30; implemented — see
`openspec/changes/archive/2026-07-02-project-activity-reporting`)`.
      ADR 0013 carries the identical stale status and references the same
      archived change, but it is out of this change's task list — left
      untouched; flagging for separate correction.

## Known gap: non-variable aliases of the tRPC client

`apps/web/uat-suite/mutation-call-sites.mjs` treats a use of the client as an
escape when it renames through a variable declaration, and as readable when it
ends in an option builder. Four aliasing shapes were closed this way, verified
one at a time. Three remain open, each a rename that is not a variable
declaration:

```ts
const o = { ns: trpc.projectActivity }; // object field
export function f(c = trpc.projectActivity) {} // parameter default
let c;
c = trpc.projectActivity; // assignment
```

None occurs in the tree today. The obvious fix — treat every use that is not a
builder call and not a call argument as an escape — was implemented and reverted:
it turns all 42 verified mutations unresolvable, because legitimate uses exist
that are neither. A check that flags everything is as useless as one that flags
nothing, so the completion needs the benign shapes enumerated from what the code
actually does, not guessed.

The gap cuts both ways, and the first write-up of it here was wrong to say
otherwise.

Beside an ordinary call site, an alias hides one call site: the mutation keeps
the VERIFIED its readable sites earned while the aliased one goes unread. That is
a missed detection.

As the ONLY reference, it is worse. Consumer counting is a text scan for
`namespace.procedure`, and an alias never writes that string —
`const o = { ns: trpc.projectActivity }` followed by `o.ns.attachLead` contains
neither half together. The count comes back zero, the mutation is reported as a
black hole, and the gate fails a correctly wired call. A false failure on working
code is the more expensive direction: it trains people to reach for the allowlist,
which is how a gate stops meaning anything.
