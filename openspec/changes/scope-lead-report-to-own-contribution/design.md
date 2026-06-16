# Design: scope-lead-report-to-own-contribution

## Context

Decision reached via grill-with-docs-codex. The user's intent: "as a lead I want
to see only my own records". Act-2 Codex review corrected the baseline — the lead
page currently DOES surface foreign content, so this change is larger than first
scoped.

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

## Decisions

### D1 — Content is own contribution; product health is honest (grill variant 2)

Record content (items / risks / decisions) is strictly the lead's own. The
co-owned product's health colour still reflects ALL contributing leads' stages.
Hiding foreign stage health would let a lead see green while a co-owner's stage
is blocked — they would learn of the failure last.

Rejected — variant 1 (colour from own stages only): makes the lead blind to a
co-owned product going red; only correct if severity is secret within a group,
which it is not here.

### D2 — Remove foreign records, not just counts

The foreign-record merge (`crossAuthorSections` → `mergedRisks` /
`mergedDecisions` / `merged*Items`) is removed from the lead page. The page
renders own records only. This reverses the W5/W6 foreign-kanban behaviour on the
lead surface — a deliberate trade-off the user chose.

### D3 — Product context is a status-only read model

Replace the content-bearing `crossAuthorSections` lead-path read with a
status-only projection: per shared product, the foreign stages and their
traffic-light status, anonymized to initials. No text, no counts, no full names.

### D3a — Foreign stage status uses the canonical derivation

Foreign stage colour derives from the traffic-light-from-risks rule
(`status-risk-unification` / `risk-stage-integrity`), NOT the blocked-item path
in `deriveEffectiveStageStatus`. This removes the inconsistency where foreign
blocked items colour a chip while risks are the stated single source of truth.

### D4 — No lead-page toggle

Lead page is single-mode: own records + honest, status-only product context.
`by product` / `by lead` stays the head grouping axis (`CONTEXT.md`).

### D5 — Ownership is by authorship, not by stage

A risk spanning the lead's own stage and a co-lead's stage is "own" iff the lead
authored it. Authorship, not stage membership, decides own-vs-foreign.

### D6 — Authorization / privacy bound

Product context is returned only to a caller who owns a section in (or has access
to) the given report; an arbitrary or unrelated `reportId` returns nothing.
Foreign context is limited to products the caller is assigned to, anonymized to
initials + status. Severity-in-colour is non-secret within one reporting group.

`User` has no initials field. The backend MAY read `user.name` internally to
derive initials, but the API response and frontend props MUST carry initials
only — the full foreign name never crosses the API boundary.

### D7 — Naming scope (avoid wording collision)

"Foreign stages" / "dimmed identity-only chip" applies to the SDLC pipeline
Product context chip ONLY — not the item-row stage chip, which `report-card-
clarity` already defines as an identity label. The two are distinct surfaces.

## Edges (Codex blind-spots, resolved)

- Products the lead does not contribute to → not shown.
- A co-owner with ownership but zero items/risks → stage shows as identity +
  status, no counts.
- Archived products → excluded (kept from current behaviour).
- Submit / completeness → unchanged: a lead submits their own section only.
- Slides mode → same own-records rule as the form; honest product health kept.

## Open questions

- None blocking. If severity later becomes group-sensitive, revisit D1 toward
  variant 1 behind an explicit flag.
