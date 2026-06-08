# Scenario Catalog — durable behavioral UI sweep

This directory holds the **Scenario Catalog**: a durable, behavior-anchored map
of what each role can do in the app, used to drive the per-role UI sweep.

Read the design first — this README only pins the *format*:

- ADR: `docs/adr/0001-live-exploratory-ui-sweep.md`
- Terms (Behavioral Scenario, Scenario Catalog, Driver, Role sweep): `CONTEXT.md`
- Change: `openspec/changes/behavioral-ui-regression-gate/`

## What the catalog is — and is not

- **One file per role**: `e2e/catalog/<role>.yaml` (`lead.yaml`, `head.yaml`, …).
- **Anchored to behavior, not structure.** Each entry is `role · route · intent`
  plus Given/When/Then prose. **No `file:line`, no selectors, no test names.**
  Structural anchors rot on an MVP; intents survive refactors.
- **Durable and high-level, NOT exhaustive.** The catalog lists *what intents
  exist per route*, not every element, state, or transition. Exhaustive
  within-route exploration is the **Driver's** job at run time — it is not
  frozen here.
- **Generated, then human-reviewed.** The catalog is produced by the catalog
  generator (Haiku fan-out, sliced by entry point) and reviewed as a diff. It is
  cheap to regenerate; do not hand-maintain it as a permanent artifact. The one
  worked example below is the *format contract* the generator must emit, not the
  catalog itself.
- **Not a BDD runner.** Given/When/Then is plain prose a Driver (human or AI
  agent) reads. The repo adds no `cucumber` / `playwright-bdd` dependency.
- **Not an authz matrix.** A per-role catalog lists only the routes that role can
  reach, so it never enumerates negative-authz ("role X is denied route Y"). The
  access boundary is a backend concern (tRPC `role-coverage-gate` + SSR guards);
  duplicating it here would be a second, rotting copy of the truth. The Driver
  still reports an *unexpected* denial on a reachable route as an anomaly
  ("expected the editor, got Forbidden") — but the catalog builds no denial grid.

## Two levels of completeness

| Level | Question | Measured by | When |
| ----- | -------- | ----------- | ---- |
| **Entry-point** (this catalog) | Does every role-reachable route have ≥ 1 intent? | generation-time critic + coverage matrix | at generation |
| **Within-route** (the Driver) | Is every interactive element / reachable transition exercised? | the live Driver exploring the route | at run time |

The generation-time critic guards **entry points only**. It must NOT chase
per-element completeness — that would re-introduce the rotting structural list
this design rejects.

## YAML schema

```yaml
role: lead              # the catalog's role
generated: true         # produced by the generator + human-reviewed (not hand-authored)
routes:
  - route: /lead/report           # the route pattern ([reportId] etc. kept as-is)
    access: [lead, head, admin]    # roles allowed by the route's SSR layout guard
    intents:
      - id: <stable-kebab-slug>    # stable across regenerations; the Driver keys reports on it
        intent: <one line: the user goal on this route>
        given: <precondition / fixture state, in prose>
        when: <the action the role takes, in prose — no selectors>
        then: <observable outcome the Driver can confirm: a visible value, a
               navigation, an absence of console/load error — NOT "it works">
        # notes: <optional caveats; e.g. depends on an open period>
```

Rules that keep the catalog trustworthy:

- **`then` must be observable**, never "it works" / "loads fine". State a visible
  string, a navigation, a persisted-then-shown value, or an explicit
  no-error/no-broken-load condition.
- **No structural anchors**: no `file:line`, no CSS/test selectors, no test
  names. If you cannot phrase an intent without them, it belongs in the Driver's
  run-time exploration, not here.
- **`id` is stable.** Reword `intent`/prose freely on regeneration, but keep `id`
  fixed so historical sweep reports stay comparable. Treat a new behavior as a
  new `id`. Stability is *enforced on regeneration*: the generator reads the
  existing `<role>.yaml` and reuses the matching `id` for an intent that is the
  same in meaning, minting a new `id` only for genuinely new behavior — it does
  not re-roll ids from scratch each run.

## Worked example — the format contract

This is the canonical shape the generator emits and the fan-out copies. It is an
*example*, not the `lead` catalog (that file is generated).

```yaml
role: lead
generated: true
routes:
  - route: /lead/report
    access: [lead, head, admin]
    intents:
      - id: lead-report-edit-open-section
        intent: Edit and save the lead's own section while the period is open
        given: A period is open and the lead has an unsubmitted section to fill
        when: The lead changes a field in their section and triggers a save
        then: The new value is shown after a reload and no console error is logged
      - id: lead-report-submit-for-review
        intent: Submit the completed section for head review
        given: A period is open and the lead's section is filled
        when: The lead confirms submission from the report editor
        then: The section moves to a submitted state and the editor reflects it as
              read-only / awaiting review, with no broken load
```

## Lead route denominator (entry-point completeness target)

The `lead` role reaches these routes (derived from the per-route SSR layout
guards, not guessed). Every one must have ≥ 1 intent for entry-point
completeness:

| Route | Guard (`access`) |
| ----- | ---------------- |
| `/` | redirects to the role home (`/lead/report`) |
| `/lead/report` | lead, head, admin |
| `/lead/report/[reportId]` | lead, head, admin |
| `/lead/report/[reportId]/preview` | lead, head, admin |
| `/lead/history` | lead, head, admin |
| `/reports` | lead, head, admin, viewer (rows scoped server-side) |
| `/reports/[reportId]` | lead, head, admin, viewer |
| `/reports/[reportId]/present` | lead, head, admin, viewer |
| `/reports/history` | lead, head, admin, viewer |
| `/reports/trends` | lead, head, admin, viewer |

Out of the lead surface (guarded away): `/head/*` (head, admin), `/admin/*`
(admin only). `/print/[reportId]` is a system/export view, swept separately if
at all — not a lead nav intent.

## The intake loop

Manual-UAT findings feed the catalog over time, on this loop:

1. **Log** the finding as one row in a lightweight `feedback-log.md`
   (`role · route · symptom · severity · next-action`). This is the quick
   manual-UAT intake; the archived `uat-feedback-2026-05-26` change is the
   reference instance. Both defects and `ok` confirmations of intended behavior
   are logged.
2. **Confirm** the behavior (against the code or a live run).
3. **Graduate** a confirmed, durable behavior into the relevant role's catalog
   as a new `intent` (or a `note` on an existing one when it sharpens an intent
   rather than adding a goal). A bare "loads fine / 0 errors" row is NOT
   graduated — the catalog's `then` must be observable (see the schema rules).
4. **Regenerate** the catalog; the generator reuses stable `id`s and only the
   genuinely new behavior is added.

Phase 2 (freezing critical, stabilized intents into deterministic Playwright
specs; and a formal Model-Based Testing state model) is deferred until the
product stabilizes — see ADR 0001.
