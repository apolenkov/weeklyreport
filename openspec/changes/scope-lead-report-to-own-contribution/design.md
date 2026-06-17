# Design: scope-lead-report-to-own-contribution

## Context

Decision reached via grill-with-docs-codex. The user's intent: "as a lead I want
to see only my own records". Act-2 Codex review corrected the baseline — the lead
page currently DOES surface foreign content, so this change is larger than first
scoped.

**Revision note:** the first cut of this change is already implemented and open
in PR #14 (own-records default + status-only Product context, foreign content
read deleted). This iteration REVISES that same change on the same branch: it adds
the Record visibility toggle and re-introduces a gated full-content read for the
Everyone state. The default behaviour (Mine only) matches what PR #14 already
ships; the toggle is the new surface. D4 is reversed; D1 / D3 / D6 (honest
health, status-only Product context, authorization) still hold and are tightened
for the two-tier read.

Baseline (verified in code, corrected after round 1):

- Own items / risks / decisions are scoped to `authorId = self`.
- BUT `leadForm.crossAuthorSections` is always loaded and `mapForeignItems` /
  `mapForeignRisks` / `mapForeignDecisions`
  (`apps/web/src/lib/mappers/lead-cross-author.ts`) copy foreign item text, risk
  text + impact + mitigation, decision text, and `authorName` into
  `mergedCurrentItems` / `mergedNextItems` / `mergedRisks` / `mergedDecisions`
  (`lead-form.tsx`), which render. This is W5/W6 from
  `fix-report-surface-integrity`.
- `leadForm.crossAuthors` additionally returns foreign item/risk counts + stage
  status; the `StageChip` "Locked" state renders the owner's full name.
- `CONTEXT.md`: a Product belongs to one group; multiple leads contribute. The
  realistic seed splits products by stage across leads (e.g. Mobile: a tech lead
  owns Development, a PM owns Plan/Analysis/Design), so co-owned products are a
  normal, recurring case.
- "Foreign" means a record NOT authored by the signed-in lead. "Everyone"
  reveals foreign records ONLY on products the lead co-owns, so a co-owner
  legitimately sees records they did not author, on shared products — never on
  products they do not contribute to.

## Decisions

### D1 — Content is own contribution; product health is honest (grill variant 2)

Record content (items / risks / decisions) is strictly the lead's own in "Mine
only" (the default). "Everyone" re-introduces the foreign content read-only as an
opt-in lens (see D2 / D4 / D4a). In BOTH states the co-owned product's health
colour still reflects ALL contributing leads' stages, from the always-fetched
status read. Hiding foreign stage health would let a lead see green while a
co-owner's stage is blocked — they would learn of the failure last.

Rejected — variant 1 (colour from own stages only): makes the lead blind to a
co-owned product going red; only correct if severity is secret within a group,
which it is not here.

### D2 — Foreign records off by default; opt-in via Everyone (REVISED)

The original W5/W6 always-on foreign-record merge stays removed: Mine only (the
default) renders own records only, and the full-content read is not even fetched.
The Everyone state re-introduces the foreign-record merge (item / risk / decision
text + full names + foreign chips) — but default-off and authorization-gated, as
a read-only lens. This is the deliberate trade-off the user chose, now expressed
as a toggle instead of a hard removal.

### D3 — Product context (health signal) is a status-only read model

The Product context — the honest health signal — is a status-only projection: per
shared product, the foreign stages and their traffic-light status, anonymized to
initials. No text, no counts, no full names. It is the ALWAYS-fetched read that
drives health in both states.

This is a SEPARATE read from the Everyone full-content read (D4a). The Everyone
read re-introduces the content-bearing `crossAuthorSections`-style payload (text +
full names + chips); it is not Product context and is fetched only on opt-in. Do
not merge the two — Product context stays status-only by definition.

### D3a — Foreign stage status uses the canonical derivation

Foreign stage colour derives from the traffic-light-from-risks rule
(`status-risk-unification` / `risk-stage-integrity`), NOT the blocked-item path
in `deriveEffectiveStageStatus`. This removes the inconsistency where foreign
blocked items colour a chip while risks are the stated single source of truth.

### D4 — Lead-page Record visibility toggle (REVISED — reverses prior D4)

The first cut of this change shipped with NO lead-page toggle. This revision
reverses that: the lead report form carries ONE **Record visibility** toggle with
two states.

- **Mine only** (default): own records + own stage chips. Foreign stage chips
  HIDDEN. The full-content read is NOT fetched. Product health colour stays
  honest from the always-fetched status read.
- **Everyone**: additionally fetches and renders, read-only, the co-owners' full
  records on products the lead co-owns — item / risk / decision text, the owning
  author's full name, and the foreign stage chips.

Scope and rules:

- The toggle is on the lead report FORM only — not slides, not head, not viewer.
- UI label is English (repo rule: static production UI strings stay English).
- It is the `Record visibility` term in `CONTEXT.md`. It is distinct from the
  head's `by product` / `by lead` grouping axis (which is unchanged).

Rejected — keep single-mode (the prior D4): leaves a co-owner able to see that a
co-owned product is red but never able to see WHAT is wrong, even though they are
accountable for the product. The lead asked to be able to investigate.

### D4a — Two-tier read: status-only always, full content on demand (Codex blind-spot #1)

The honest health colour and the foreign content come from TWO separate reads
with different sensitivity. This split is the core of the design — do not collapse
them.

- **Status-only read** (`leadForm.crossAuthors`, already shipped): per shared
  product, the foreign stages, their risk-derived traffic-light status, and the
  author's initials. No text, no counts, no full names. Fetched in BOTH states.
  This is what makes Product health honest, so health never depends on the
  toggle.
- **Full-content read** (new, gated): the co-owners' item / risk / decision text,
  full name, and foreign stage chips. Fetched ONLY when the toggle is Everyone.

So Mine only fetches the status read but never the content read; the honest
colour is paid for in both states, the content cost only when opted in.

### D4b — Toggle is view-only (Codex blind-spot #6)

The toggle changes only what the lead SEES on the form. It does NOT change:

- what the lead submits (still their own section only),
- completeness / submit gating (scoped to own records in both states),
- what the head publishes or what gets exported.

Everyone is a read-only lens over co-owners' records; it never folds foreign
records into the lead's own submission.

### D4c — Persistence (localStorage)

The chosen state is remembered in `localStorage`. The first-ever load (no stored
value) defaults to Mine only. Persistence is per-browser and view-only; it has no
server effect.

The stored key MUST be namespaced by the current user AND `reportId` (and the
period when it is part of the report context), e.g.
`leadRecordVisibility:{userId}:{reportId}`. A bare global key would let one
user's "Everyone" bleed into another user's session on a shared browser or via
the dev role-switcher, and would carry one report's choice into an unrelated
report. On any user / report context change the lookup is scoped to the new key;
when no key matches, the toggle defaults to Mine only — a stored "Everyone" is
never read under a different identity or report.

A persisted "Everyone" therefore auto-fetches the foreign full content on the
next load — that is the cost of honoring the user's "remember it" choice. The
alternative (per-session toggle, defaulting to Mine only on every load, no
auto-fetch) was considered and rejected: it would silently discard the user's
explicit preference. To avoid a flash / early-fetch race, the full-content fetch
MUST wait until the persisted state has loaded and the UI reflects "Everyone"
before firing; it must never fire on the server-render default before hydration.

### D4d — Honest colour while chips are hidden is accepted (Codex blind-spot #2)

In Mine only, a co-owned product can read red/at-risk while its foreign stage
chips are hidden — the lead sees the colour but not the failing stage. This is a
DELIBERATE UX choice, not a leak: red means "switch to Everyone and investigate".
It keeps the default surface clean (own work) while never hiding a product going
red. Accepted as designed.

### D5 — Ownership is by authorship, not by stage

A risk spanning the lead's own stage and a co-lead's stage is "own" iff the lead
authored it. Authorship, not stage membership, decides own-vs-foreign.

### D6 — Authorization / privacy bound (two-tier — Codex blind-spot #3/#8)

Authorization has two tiers, matching the two reads. The full-content read is
strictly MORE sensitive than the status read and gated harder.

- **Status-only read:** returned only to a caller who owns a section in (or has
  access to) the given report; an arbitrary or unrelated `reportId` returns
  nothing. Anonymized to initials + status. `User` has no initials field — the
  backend MAY read `user.name` internally to derive initials, but the API
  response and frontend props MUST carry initials only; the full foreign name
  never crosses this boundary. Within a report the caller has access to, the
  status-only read INTENTIONALLY returns initials + risk-derived status for ALL
  contributing stages, including products the caller does not co-own — this
  cross-product status disclosure within one reporting group is the shipped
  honest-health basis, not a defect (it carries no text, counts, or full names).
- **Full-content read:** returned only to a caller who (a) has access to the
  report AND (b) co-owns the product whose foreign records are requested. An
  unrelated or arbitrary `reportId`, or a product the caller does not co-own,
  returns nothing — even for an otherwise-authorized lead. A dedicated NEGATIVE
  authorization test pins this (an unrelated `reportId` / a non-co-owned product
  yields empty).
- **No head/admin bypass on the full-content read.** The full-content gate is
  report-access AND product co-ownership for ALL callers, with no role
  exception. This is a lead-coworker investigation lens, not an admin tool; a
  head or admin who does not co-own the product is denied (empty), exactly like
  any other non-co-owner. Head and admin see cross-author content through their
  own surfaces, not through this lead-form read. The server authz MUST NOT
  depend on the lead-form-only toggle — the toggle gates only whether the
  request is issued, never whether it is authorized.

Severity-in-colour is non-secret within one reporting group.

### D6a — Within-group exposure is intentional (decision, NOT a defect)

Revealing co-owners' full names + record text in "Everyone" is intentional
within a single reporting group. There is NO per-author consent model: the gate
is report-access AND product co-ownership, NOT author opt-in. A lead does not
get to hide their records from a co-owner of the same product. This is a
deliberate decision, not a privacy gap. If cross-group sharing ever arises
(records exposed beyond the authoring group), this decision is revisited — that
boundary does not exist today.

### D6b — Denied vs. empty observability (Codex blind-spot)

A denied full-content read returns empty, which makes a "denied" outcome
indistinguishable from a "legitimately empty" one (caller co-owns nothing, or no
foreign records exist). For auditing the authorization boundary, the backend
emits a metric/log distinguishing the denied path from the empty-result path.
Metric named up front per the repo's deferred-feature / observability
convention: a Prometheus counter `customreport_cross_author_content_reads_total`
with a `result` label of `allowed`, `denied`, or `empty`. The response payload
stays empty in both the denied and the empty case (no leak); only the
server-side signal distinguishes them.

### D7 — Naming scope (avoid wording collision)

"Foreign stages" / "dimmed identity-only chip" applies to the SDLC pipeline
Product context chip ONLY — not the item-row stage chip, which `report-card-
clarity` already defines as an identity label. The two are distinct surfaces.

## Edges (Codex blind-spots, resolved)

- Products the lead does not contribute to → not shown in either state.
- A co-owner with ownership but zero items/risks → in Mine only the stage chip is
  hidden but health stays honest from the status read; in Everyone the foreign
  stage chip shows as identity + status, no counts.
- Archived products → excluded (kept from current behaviour).
- Submit / completeness → unchanged in BOTH states: a lead submits their own
  section only; Everyone is view-only (D4b).
- Slides mode → toggle does NOT apply; slides always show own records only and
  keep honest product health.
- Toggle in Everyone but caller co-owns nothing → status read still drives honest
  health; the full-content read returns empty, so no foreign records render.

## Open questions

- None blocking. If severity later becomes group-sensitive, revisit D1 toward
  variant 1 behind an explicit flag.
