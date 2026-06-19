# Handoff — backlog converted to specs (2026-06-19)

> **STATUS 2026-06-19 (later): ALL SIX CHANGES ARE NOW IMPLEMENTED + ARCHIVED.**
> The "READY for the new session / ready to implement" framing below is
> HISTORICAL — do not re-implement any of it. A follow-on autonomous session
> built, gated, live-verified, and archived the whole backlog on this branch.
>
> **Repo:** `/Users/wrk/work/customreport` · **Branch:** > `openspec-slides-comingsoon-greenseed`, **clean tree, NOT pushed** (branch-only,
> push on request). `openspec list` → "No active changes found".
>
> **Feature commits (newest first):**
>
> - `1f6d0514` docs(openspec): archive the 7 shipped changes + sync specs
> - `eb1de8a0` feat(slides): Mine/Everyone record visibility in the lead deck (flagship)
> - `385c1693` feat(schema): require a stage on items + decisions at the write layer
> - `5ebc2013` feat(lead-pipeline): "Your stages" label + reveal Mine-hidden stages
> - `53716a23` feat(report-toolbar): sticky lead context bar on scroll
> - `1954caa6` feat(seed): broaden co-owner cross-author content across both weeks
>
> Each landed gates-green (typecheck, web 1196, api 951, lint) + live-verified.
> The flagship passed a Codex Act-2 review (VERDICT: REVISE → all 4 findings
> folded in; see `openspec/changes/archive/.../slides-record-visibility/design.md`).
>
> **Open follow-ups (non-blocking, for the record — NOT rework):**
>
> 1. Flagship: the per-row "foreign" visual marker on slides is DEFERRED (the
>    slide grids are flat `string[]`; ADR 0003). Counts + rows merge correctly.
> 2. Flagship: Codex returned REVISE and was NOT resubmitted for an APPROVED
>    verdict — the no-leak property was instead live-verified. If you re-run
>    Codex, use a FRESH session (a resumed one rubber-stamps).
> 3. Flagship: `lead-form`'s edit-path `crossAuthorContentQ` still fires in
>    slides mode (gated on `isEveryone`, not own-deck). On a foreign `authorId`
>    deck it caches the current user's OWN co-owner data but never displays it
>    (slides render `LeadSlidesClient`, not the edit JSX) — not a leak, a loose
>    seam if you want to tighten the fetch gate later.
> 4. Codex `< /dev/null` fix: a bare `codex exec "..."` hangs on stdin-EOF, not
>    the proxy — always redirect stdin (or use the codex:rescue agent).
>
> Everything below is the ORIGINAL pre-implementation handoff, kept for context.

---

**Repo:** `/Users/wrk/work/customreport` · **Branch:**
`openspec-slides-comingsoon-greenseed`, **not pushed**. Commits this session =
the 5 implemented changes listed below + docs/openspec commits (A hardening, the
4 satellite specs, this handoff). Run `git log --oneline 16f85a94..HEAD` for the
exact set; `16f85a94` is the pre-session base.

## Bottom line

The 2026-06-18 live-demo session shipped 5 small changes and then the user asked
to **convert everything still outstanding into OpenSpec changes and start fresh
next session**. This doc is the index. No further code was written after the 5
commits; the rest is specs ready to implement.

## Shipped + committed this session (branch only)

1. `5d8ad0bb` fix(seed): Платформа интеграций fully green in small tier (live-verified).
2. `e4c84bfb` test(coming-soon): one-canonical-style guards + corrected Holidays a11y premise (no prod code; aria-label deliberately NOT re-added).
3. `76e658ef` feat(seed): archived history periods in small tier → show-archived toggle visible (live-verified).
4. `54a3f0c5` feat(seed): co-owner cross-author records (Maria/Igor decisions) → Everyone shows them, Mine hides (live-verified).
5. `afff9802` feat(lead): require a concrete stage when adding items+decisions (dialog layer; 5 tests; live-verified). OpenSpec: `require-stage-on-items-and-decisions`.

All gates green at each commit (typecheck, lint, full test ~2700 tests, format).

## OpenSpec changes READY for the new session (priority order)

### 1. `slides-record-visibility` (the flagship — A)

Mine/Everyone toggle in slides + toolbar parity. **Self-grilled + hardened this
session** against the impact-map findings; `validate --strict` clean. Key
hardenings folded in:

- Decision 2 **resolved**: ScopeToggle "Own" → **"Summary"** (user-confirmed; value/key stays "own").
- Decision 3 **sharpened**: merge at the SLIDE-MODEL layer producing NEW objects;
  NEVER mutate the cached `ReportSectionReadModel` (it aliases `draftSection` →
  that is the only view-only leak vector). Regression test: `sectionToDraftPayload`
  stays own-only after a merge.
- Decision 8 **added**: foreign-content mapper shape; the client mirror drops
  `priorityRank`, so foreign rows fold into grids + blocked/at-risk counters but
  are excluded from priority ranking (pin with a test, don't widen the mirror).
- **Codex Act-2 review was NOT run** — `codex exec` hung on the corporate proxy
  (0% CPU, killed). Run the Codex adversarial review from a clean network /
  fresh session before implementing. The impact-map (serializers/gating/mapper)
  is in this session's transcript.

### 2. `enrich-small-seed-coowner-breadth`

More co-owner cross-author records in the small seed so Everyone reads fuller
across both week buckets (each co-owner gets a current+next item pair across 2+
shared sections). Zero new risks → resolved health stays fixed (Portal yellow,
Integrations green anchor, BI red). Capability: `demo-seed-datasets`.

### 3. `lead-pipeline-mine-reveal-and-own-stage-label`

SdlcPipeline: a "Your stages" label on the N/M counter (pure relabel —
`computeCompleteness` already counts `ownership === "mine"` only) + a
collapsed-stages indicator with a hover tooltip (ComingSoon `title`+`aria-label`
pattern) revealing the hidden (Mine-hidden) stages' statuses. Softens
`lead-mine-hide-unowned-stages` toward hide-but-reveal-on-hover. Capability:
`lead-pipeline-card`.

### 4. `sticky-report-toolbar-on-scroll`

Make the bordered ReportToolbar row `position: sticky; top: 0` via a new opt-in
`sticky` prop on `ReportToolbar`; the document-action header stays in normal
flow (two-row layout preserved); stuck state gets an opaque bg + elevation +
z-index below the NavBar dropdowns. Capability: `lead-toolbar-presentation`.

### 5. `enforce-item-decision-stage-schema`

Server-side parity for shipped change #5: require `stageIds` on items/decisions
at the write schema + a "No stage set" marker for legacy rows. **Load-bearing
catch (found in authoring):** items/decisions embed `itemInputSchema`/
`decisionInputSchema` directly in `reportSectionReadModelSchema` (unlike risks'
lenient `riskReadModelSchema`), so the change must add
`itemReadModelSchema`/`decisionReadModelSchema` (re-loosening `stageIds` for the
READ model) or stage-less legacy rows fail to parse on read. **Prerequisite:**
audit both seed tiers + fixtures for empty-stage rows FIRST. Capability:
`risk-stage-integrity`.

## Head-report annotation triage (live-checked 2026-06-19, NOT a formal change)

Most are stale or fuzzy cosmetic placement asks superseded by the shipped toolbar
redesign. Verify each visually with the user before doing anything:

- **Present / Print links "not needed"** → DONE/STALE: both are already gone from
  the head toolbar (`fix-report-surface-integrity` 308-redirects Present). Close.
- **Agent-review placement / Edit-Slides placement** → both controls exist on the
  head toolbar; only placement polish remains, likely already addressed. Confirm visually.
- **ScopeToggle "4 buttons one style like Toggle All"** → head ScopeToggle is a
  2-button Product/Leads segmented control today; the ask is visual-style parity
  with the lead toggles. Genuinely open but cosmetic — get the user's eye first.
- **Publish-lock message placement** → minor; confirm with user.

## Decisions locked this session (so the new session doesn't re-litigate)

1. Holidays Coming-Soon control gets **no** aria-label (reverting it would undo
   the deliberate `verify-a11y-recommended-flip` removal; the deferred state is
   already in the tab's accessible name).
2. ScopeToggle "Own" → "Summary" (slides).
3. Items + decisions **require a stage** (dialog layer shipped; schema layer = change #5).
4. Access-consistency (own products / own stages per product / single-stage
   auto-lock) was already enforced — verified live; not a bug.

## Environment gotchas

- `codex exec` **hangs on the corporate proxy** (0% CPU forever) — wrap in a
  watchdog/kill, or run Codex from a clean network. This blocked A's Act-2.
- Reseed: `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1 pnpm db:seed:small`.
- `npx prisma generate` before gates (client gets wiped by pnpm ops).
- Web tests: run from `apps/web` (or `pnpm --filter @customreport/web`); no
  `timeout` binary on macOS.
- Push to `main` is allowed but do it only on request; this branch is unpushed.

## Suggested start for the new session

```
# A: run Codex Act-2 (clean network), then implement
/openspec-apply-change slides-record-visibility
# then the satellites, simplest first
/openspec-apply-change enrich-small-seed-coowner-breadth
/openspec-apply-change sticky-report-toolbar-on-scroll
/openspec-apply-change lead-pipeline-mine-reveal-and-own-stage-label
/openspec-apply-change enforce-item-decision-stage-schema
# archive the 5 already-shipped changes (watch openspec-archive spec-debt)
```
