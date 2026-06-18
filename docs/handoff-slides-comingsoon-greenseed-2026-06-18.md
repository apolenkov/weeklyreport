# Handoff — 3 specs ready for implementation (2026-06-18)

**Repo:** `/home/user/work/customreport` · **Branch:** `main` (these are
unimplemented OpenSpec changes; implement on a feature branch next session).

## Bottom line

Three OpenSpec changes are authored, `validate --strict` clean, and
Codex-reviewed. **Not implemented** — next session implements them. Produced
autonomously while the user was away; the user asked for full specs, with each
decision vetted by advisor + Codex.

**Codex Act-2 verdicts:** SPEC B (coming-soon) APPROVED; SPEC C (green seed)
APPROVED; SPEC A (slides) REVISE → 2 majors folded in: (A-1) Everyone only on the
lead's own deck — a foreign `authorId` URL forces Mine, no merge; (A-2) the merge
adds no new health-vs-count divergence (it pre-exists in own mode) and no
double-count. A re-validated clean after the revisions.

## The three changes (priority order)

### 1. `slides-record-visibility` (the big one — has an ADR)

Add the Mine/Everyone toggle to **slides** mode so (a) the lead toolbar is 1:1
across edit↔slides (icons stop floating) and (b) slides Everyone merges
co-owners' cross-author content into the deck's grids + KPI counters
(view-only). Reverses the `scope-lead-report-to-own-contribution` "slides carry
only own records" decision → **ADR required** (`design.md` Decision 1).

Key constraints (in the spec):

- Everyone in slides is strictly **view-only** — never reaches
  submit/draft/published-snapshot/export. Highest-value test.
- Health stays toggle-independent (already folded from `crossAuthors`).
- Gating/purge parity with edit (hydration guard; purge `crossAuthorContent`).
- **Open decision (needs user):** the slide `ScopeToggle` "Own" reads like
  "Mine". Recommended: relabel "Own" → "Summary"/"Section". Confirm wording.
- Tasks are phased: Group 1 = toolbar parity (small), Group 2 = Everyone content
  (the feature). Ship together (no dead toggle), but Group 1 is low-risk.

Files: `lead-form.tsx`, `slides/lead-slides-client.tsx`,
`slides/section-slide-utils.ts`, cross-author mappers. ADR → `docs/adr/`.

### 2. `coming-soon-style-consistency`

**Finding: the user's visual ask is already satisfied.** All 5 on-screen Coming
Soon badges (incl. Agent review) compute to ONE amber style — verified live:
`bg oklch(0.962 0.059 95.617)`, `color oklch(0.555 0.163 48.998)`. No red/yellow
variant exists; Agent review already matches. So **no restyle**. This change just
(a) codifies "one Coming Soon style" as a testable invariant + regression guard,
and (b) fixes the one real drift: `HolidaysComingSoonControl` is missing an
`aria-label`. Optional wrapper consolidation is documented as a NOT-queued
follow-up (refactor of working code — needs explicit go-ahead).

Files: `admin/settings-tab.tsx` + a new regression test.

### 3. `seed-all-green-example-product`

Make **Платформа интеграций** fully green in `SMALL_DATASET` (drop Vasily's
at-risk Development risk; co-owners already green) so the demo shows a healthy
product. Portal stays blocked, BI stays red. Preserve durable invariants (BI
multi-stage item, Portal blocked item). Files: `prisma/seed-demo.ts`.

## Decisions made for the user (surfaced, not buried)

1. SPEC B premise (red/yellow difference) is **false** — already uniform; B is a
   guard + a11y fix, not a restyle. Reverse only if the user disagrees.
2. "Everyone" in slides = existing cross-author scope (co-owners of my products),
   NOT the whole group portfolio (the "all leads of the group" phrasing).
3. Reversing "slides own-only" is intentional → ADR.
4. ScopeToggle "Own"→"Summary" relabel is recommended but needs user confirm.

## Implement next session

Suggested order: 3 (trivial) → 2 (small) → 1 (feature, with ADR + Codex review).

```
/openspec-apply-change seed-all-green-example-product
/openspec-apply-change coming-soon-style-consistency
/openspec-apply-change slides-record-visibility
```

Gates: `npx prisma generate` first; `pnpm typecheck && pnpm lint && pnpm test &&
pnpm format:check`. Live-verify slides at 1200px (dev-login lead1). Archive each
with `openspec archive <id> -y`.

## Memory pointers

- `coming-soon-one-style-lesson` — the "all one style" lesson + the already-uniform finding.
- `demo-feedback-pipeline-visibility-2026-06-18` — the just-shipped Mine-hide + seed work this builds on.
- `coming-soon-is-deferred-not-loose-ends` — Coming Soon = intentionally parked.
