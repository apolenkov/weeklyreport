# Proposal: scope-lead-report-to-own-contribution

## Why

The lead's own report page (`/lead/report/<id>`) must read as "my work". Today it
does NOT: on a co-owned product the page merges **other authors' full records**
into the lead's own surface. The `leadForm.crossAuthorSections` query is always
loaded, and `mapForeignItems` / `mapForeignRisks` / `mapForeignDecisions` copy
foreign item text, risk text + impact + mitigation, decision text, and the
author's full name into `mergedCurrentItems` / `mergedNextItems` / `mergedRisks` /
`mergedDecisions`, which render on the page. A second query
(`leadForm.crossAuthors`) additionally feeds foreign item/risk **counts** and
status into the Product Status card.

This is the W5/W6 "foreign kanban (read-only)" behaviour from
`fix-report-surface-integrity`. The lead asked to see only their own records.
This change removes foreign **records** from the lead page **by default** while
keeping the co-owned product's **health colour** honest — so a co-owner is not
blind to a red stage they do not own — shown as anonymized, status-only Product
context.

Decision locked via grill-with-docs-codex (variant 2): content is own by default;
product health stays honest; foreign stages are dimmed, identity-only (initials +
status), derived from risks; severity inside one group is not secret.

**Revision (this iteration, on the same PR #14 / same branch):** the prior cut
removed the lead-page toggle entirely (D4 "No lead-page toggle"). The lead asked
to be able to opt in to the co-owners' full records on the products they co-own —
so a co-owner can actually investigate the red stage instead of being told only
that it is red. This revision REVERSES D4: it adds one **Record visibility**
toggle on the lead report form with two states, **Mine only** (default) and
**Everyone**. The toggle is view-only and re-introduces a foreign-content read
that the first cut had deleted — but default-off and authorization-gated. The
honest-health invariant from D1/D3 is unchanged: it never depends on the toggle.

## What Changes

- **A Record visibility toggle is added to the lead report form** — one control
  with two states, **Mine only** (default) and **Everyone**. UI label is English
  (repo rule: static production UI strings stay English). The toggle lives on the
  lead REPORT FORM only — not on slides, not on the head or viewer surfaces.
- **Two-tier foreign read** — the read splits into two reads with different
  sensitivity:
  - **Status-only read (always fetched):** the existing `leadForm.crossAuthors`
    returns per-stage, risk-derived traffic-light status plus author initials —
    no content, no counts, no full names. This feeds the honest Product context
    health colour and is fetched in BOTH toggle states.
  - **Full-content read (fetched on demand, Everyone only):** a separate,
    gated read returns the full foreign records — item / risk / decision text,
    the owning author's FULL NAME, and the foreign stage chips — for co-owners
    on products the lead co-owns, read-only. It is fetched only when the toggle
    is **Everyone**, and never in **Mine only**.
- **Mine only (default) renders own records only** — no other author's item,
  risk, or decision text renders; foreign stage chips are HIDDEN; the
  full-content read is NOT fetched. The lead page shows only the signed-in lead's
  own items / risks / decisions and own stage chips.
- **Everyone shows the co-owners' full records** — when the lead opts in, the
  full-content read renders the co-owners' item / risk / decision text, their
  full names, and the foreign stage chips, read-only, on products the lead
  co-owns. This re-introduces the foreign-content read the first cut deleted —
  but default-off and authorization-gated.
- **The toggle is view-only** — it changes only what the lead SEES. It does not
  change what the lead submits, nor what gets published or exported. Submission
  and completeness stay scoped to the lead's own section in both states.
- **Persistence** — the chosen state is remembered in `localStorage`; the
  first-ever load defaults to **Mine only**.
- **Foreign counts stay removed** — the status-only `crossAuthors` does not
  return / render `itemCount` / `riskCount` in either state.
- **Status-only read carries initials only** — no `assignee` full name reaches
  the status read or the `StageChip`; the full name appears only via the gated
  full-content read in **Everyone**.
- **Product health colour stays honest in BOTH states** — a co-owned product
  reflects all contributing leads' stages, derived from the always-fetched
  status read. The honest colour never depends on the toggle. Showing a red
  product health while the foreign chips are hidden in **Mine only** is a
  deliberate signal: red means "switch to Everyone and investigate".
- **Foreign stage status derives from risks** — the canonical traffic-light rule
  (`status-risk-unification`), not the blocked-item path.
- **Slides mode is unchanged by the toggle** — lead slides always show own
  records only and keep honest product health; the toggle does not apply there.
- **Authorization is explicit and two-tier** — the status-only read is returned
  only to a caller who owns a section in / has access to that report. The
  full-content read is MORE sensitive: the caller must have access to the report
  AND co-own the product; an unrelated or arbitrary `reportId` / product yields
  nothing.

## Capabilities

- `lead-pipeline-card` (modified) — lead-page Record visibility toggle (Mine
  only default / Everyone), two-tier foreign read, honest status-only Product
  context, gated full-content read, slides unaffected, authorization bound.

## Impact

### Shared / API contract (do first)

- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` —
  - `getCrossAuthors` (status-only, already shipped) is unchanged: per-stage
    risk-derived status + initials, no counts, no full names, caller-access
    gated. Still fetched in BOTH toggle states.
  - **Restore a gated full-content read** (`getCrossAuthorContent`) that returns
    the co-owners' item / risk / decision text plus the owning author's full
    name and foreign stage chips, for products the caller co-owns on the given
    report. This re-introduces the `getCrossAuthorSections`-style content read
    that the first cut deleted — now with a STRICTER authorization bound
    (report access AND product co-ownership) and consumed only by the Everyone
    state.
- tRPC `leadForm` router — `crossAuthors` unchanged; add a new `protectedProcedure`
  (e.g. `crossAuthorContent`) taking `{ reportId }`, returning the full-content
  shape, gated server-side. Consumer: the lead form's Everyone state only (not
  slides).
- Shared types: re-introduce the foreign-content shapes consumed by the Everyone
  read (`CrossAuthorSection` / `ForeignKanbanItem` / `ForeignRiskEntry` /
  `ForeignDecisionEntry` or their equivalents), distinct from the status-only
  `CrossAuthorEntry`.

### Frontend

- `apps/web/src/components/lead/lead-form.tsx` — add the Record visibility
  toggle (Mine only / Everyone); persist the state in `localStorage`; fetch the
  full-content read only when Everyone; in Mine only, render own arrays and hide
  foreign chips; in Everyone, merge the foreign records read-only.
- `apps/web/src/lib/mappers/lead-cross-author.ts` — keep the status-only
  Product-context projection (always on); re-introduce the `mapForeign*`
  content mappers, used only when the Everyone full-content read is present.
- `apps/web/src/components/lead/sdlc-pipeline.tsx` — Mine only: foreign chips
  hidden, product health honest from the status read. Everyone: foreign stage
  chips visible (identity + status). Health honest in both.
- `apps/web/src/components/lead/stage-chip.tsx` — status-only path shows
  initials; the full foreign name appears only in the Everyone full-content
  surface.
- `CONTEXT.md` — terms **Own contribution**, **Product context**, **Record
  visibility** (Mine only / Everyone), already updated during the grill.
