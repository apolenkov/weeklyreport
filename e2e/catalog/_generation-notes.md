# Catalog generation notes — recurring defects + hardening

Findings from the autonomous head/admin generation run (2026-06-07), kept here so
a future regeneration does not silently reintroduce them. This is the human-review
guardrail the design relies on (the generator's critic checks intents-per-route,
not route-string hygiene).

## Defect class found: parentheticals leaked into the `route` value

The DISCOVER agent sometimes appended a prose annotation to the route string
instead of putting it in `access`/`note`, producing a route value that is not a
clean URL:

| File | As generated | Fixed to |
| ---- | ------------ | -------- |
| `viewer.yaml` | `route: viewer-landing` (label, not a URL) + `access: []` | `route: /` + `access: [lead, head, admin, viewer]` |
| `head.yaml` | `route: /lead/report (access: head)` + `access: []` | `route: /lead/report` + `access: [lead, head, admin]` |
| `admin.yaml` | `route: /admin/settings (307 redirect to /admin?tab=settings)` + `access: []` | `route: /admin/settings` + `access: [admin]` |

**Why it matters:** the sweep navigates with `page.goto(route)` and the parser
keys on `^\s*-\s*route:\s*(\S+)\s*$`. A route with a trailing parenthetical fails
that match, so the route is **silently skipped** — the exact "silent drop" failure
mode the census/critic hardening (task 1.4b) exists to prevent, but at the
route-string level the critic does not see.

`access: []` is the tell: all three defects also lost their guard list, because
the agent put route metadata in the wrong field.

## Defect class found: hallucinated controls on a read-only route

`head.yaml` `/reports/[reportId]/present` carried three mutation intents —
`head-publish-lock-period`, `head-reopen-published-period`,
`head-archive-published-report` — that **do not exist on that route**. The page
(`apps/web/src/app/(app)/reports/[reportId]/present/page.tsx`) renders only
`HeadPresentClient` (a read-only slide deck: section navigation + fullscreen; no
`useMutation`, no publish/reopen/archive). Those mutations live on
`/head/report/[reportId]`; the extractor duplicated them onto the presentation
view. Removed (kept the two real intents: navigate-section, toggle-fullscreen).
The adversarial review flagged this as "verify the presentation view actually
exposes these controls" — confirmed by reading the component. `admin.yaml`'s
present route was clean (navigate / fullscreen / return-to-report only).

Also fixed: a DOM selector (`[data-product-accordion-toggle]`) leaked into an
`admin` intent `note` (violates the "NO selectors" rule) and a vacuous/structural
`then` on `head-present-toggle-fullscreen` — both rephrased to observable
behavior.

## Deterministic checks (run after any regeneration)

```sh
# 1. Every route must be a clean URL path (starts with /, no trailing prose).
awk '/^[[:space:]]*-[[:space:]]*route:/{print FILENAME": "$0}' e2e/catalog/*.yaml \
  | grep -vE 'route:[[:space:]]*/[^[:space:]]*[[:space:]]*$'   # must print nothing

# 2. No empty access list (every reachable route has an SSR guard).
grep -rn 'access: \[\]' e2e/catalog/*.yaml                     # must print nothing
```

## Generator hardening (DONE 2026-06-07)

`generate-catalog.workflow.mjs` now asserts route hygiene after Discover
(alongside the census + id-uniqueness asserts): it aborts before extract if any
route value is not a clean `^/\S*$` URL or any kept route has empty `access`,
listing the offenders. The Discover prompt also got an explicit route-hygiene
rule (route is a URL and nothing else; redirect/caveat goes in `note`; `access`
is the SSR-guard array and never empty). Mirrors the 1.4b pattern — a mechanical
check the LLM critic cannot be trusted to catch.

NOTE: the hallucinated-controls class (mutations on a read-only route) is NOT
deterministically checkable — it needs the adversarial review (or human) to read
the component. The review caught it; keep that review step on every regeneration.

WARNING: these four roles' catalogs were hand-fixed AFTER generation. A plain
re-run of the generator will reproduce the route-hygiene defects only if Discover
still misbehaves (now guarded), but will NOT know about the head present-view
hallucination removal — re-confirm it on regeneration.
