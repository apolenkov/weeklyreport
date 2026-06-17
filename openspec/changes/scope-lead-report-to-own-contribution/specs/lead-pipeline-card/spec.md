# lead-pipeline-card

## ADDED Requirements

### Requirement: The lead report form carries a Record visibility toggle

The lead report form MUST carry exactly one Record visibility control with two
states, "Mine only" (default) and "Everyone", with an English UI label, and the
control MUST appear only on the lead report form — not on slides, not on the head
or viewer surfaces.

The toggle's chosen state MUST persist in `localStorage`, and the first-ever load
with no stored value MUST default to "Mine only". The stored key MUST be
namespaced by the current user and `reportId` so a persisted "Everyone" never
bleeds across users or reports on a shared browser or via the dev role-switcher;
on a user or report context change with no matching key, the toggle MUST default
to "Mine only".

The toggle MUST be view-only: it MUST NOT change what the lead submits, the
completeness or submit gating, or what the head publishes or exports — in either
state those stay scoped to the lead's own records. The publish and export flows
MUST NOT consume the toggle or the full-content read; their output MUST be
identical regardless of the toggle state.

#### Scenario: first-ever load defaults to Mine only

- **WHEN** a lead opens their report form for the first time with no stored
  visibility preference
- **THEN** the Record visibility toggle is set to "Mine only"
- **AND** only the lead's own records render

#### Scenario: toggle does not affect submission

- **WHEN** a lead switches the toggle to "Everyone" and then submits their section
- **THEN** the submitted section contains only the lead's own records
- **AND** no foreign record is folded into what is submitted, published, or
  exported

#### Scenario: persisted Everyone does not bleed across users or reports

- **WHEN** one user sets "Everyone" and a different user (or the same user on a
  different report) opens the lead report form on the same browser
- **THEN** the second context has no matching stored key and the toggle is set to
  "Mine only"
- **AND** the first user's "Everyone" preference is never read under the other
  identity or report

#### Scenario: publish and export are independent of the toggle

- **WHEN** the head publishes the report and the report is exported, first with a
  lead in "Mine only" and again with that lead in "Everyone"
- **THEN** the published and exported output is identical in both cases
- **AND** the publish and export flows issue no full-content foreign read

### Requirement: In Mine only the lead page renders only the lead's own records

In the default "Mine only" state, the lead's own report page MUST render, as
records, only the signed-in lead's own items, risks, and decisions, and MUST NOT
render any other author's item text, risk text, impact, mitigation, decision
text, item/risk counts, or full name; foreign stage chips MUST be hidden and the
full-content foreign read MUST NOT be fetched.

Ownership is decided by authorship: a record is "own" iff the signed-in lead
authored it, regardless of which stages it spans.

#### Scenario: a co-owned product with another lead's records

- **WHEN** a lead in "Mine only" opens their report page for a product whose
  stages are split with another lead who has filed items, risks, and decisions
- **THEN** only the signed-in lead's own items, risks, and decisions render
- **AND** no foreign item text, risk text/impact/mitigation, decision text, count,
  full name, or foreign stage chip appears anywhere on the page
- **AND** no network request is issued to the full-content foreign endpoint
  (the guarantee is the absence of the request, not client-side filtering of a
  fetched response)

#### Scenario: a risk spanning an own stage and a co-lead's stage

- **WHEN** the signed-in lead in "Mine only" authored a risk naming both their
  own stage and a co-lead's stage
- **THEN** that risk renders as the lead's own record
- **AND** a risk authored by the co-lead never renders as text in "Mine only"

### Requirement: A co-owned product's health is honest in both toggle states

The product health colour on a lead's card MUST reflect every contributing lead's
stages in BOTH "Mine only" and "Everyone", so a co-owning lead is never shown a
healthy product while a co-owner's stage is at-risk or blocked. The honest health
colour MUST derive from the always-fetched status-only read and MUST NOT depend on
the toggle state.

The honest colour MUST stay correct even when foreign stage chips are hidden in
"Mine only"; a red product health with hidden foreign chips is the accepted signal
to switch to "Everyone" and investigate. Foreign stage status MUST derive from the
canonical traffic-light-from-risks rule, not a blocked-item path.

#### Scenario: a co-lead's stage is blocked, lead in Mine only

- **WHEN** a co-lead owns the Testing stage of a shared product and it is blocked,
  the signed-in lead's own stages are all green, and the lead is in "Mine only"
- **THEN** the product health colour reads at-risk/blocked, not green
- **AND** no foreign stage chip is shown for the co-lead's Testing stage

#### Scenario: a co-lead has ownership but no records, lead in Mine only

- **WHEN** a co-lead owns a stage on the shared product but has filed no items or
  risks, and the lead is in "Mine only"
- **THEN** the product health stays honest from the status read
- **AND** no foreign stage chip and no counts are shown

### Requirement: In Everyone the lead page shows co-owners' full records

In the "Everyone" state, the lead report form MUST fetch and render, read-only,
the full records of co-owners on products the signed-in lead co-owns — item, risk,
and decision text, the owning author's FULL NAME, and the foreign stage chips —
and MUST NOT fold them into the lead's own submission.

The full-content foreign read MUST be fetched only in "Everyone", never in "Mine
only". Foreign stage status on the shown chips MUST derive from the canonical
traffic-light-from-risks rule. Foreign stage chips on the SDLC pipeline are the
Product context chip, distinct from the item-row stage chip.

#### Scenario: lead switches to Everyone on a co-owned product

- **WHEN** a lead switches to "Everyone" on a product whose stages are split with
  a co-lead who has filed items, risks, and decisions
- **THEN** the co-lead's item, risk, and decision text, full name, and foreign
  stage chips render read-only
- **AND** the lead's own records still render
- **AND** the full-content read is fetched only after switching to "Everyone"

### Requirement: Fetched foreign content is purged on toggle-off and context change

The previously fetched full-content foreign data MUST be purged from the client —
the query cache, component state, and the DOM — on switching from "Everyone" back
to "Mine only" AND on any identity or context change that could downgrade
authorization: logout, role switch, report switch, product switch, and any
authorization downgrade. After any of these, no foreign record text, author name,
or foreign chip MUST linger rendered or cached.

A subsequent return to "Everyone" MUST re-fetch the foreign content rather than
serving stale cached data, since "Mine only" is required to hold no foreign
content.

#### Scenario: foreign content does not linger after switching back to Mine only

- **WHEN** a lead switches to "Everyone" on a co-owned product, the co-owners'
  records render, and the lead then switches back to "Mine only"
- **THEN** no foreign record text, author name, or foreign chip remains rendered
  anywhere on the page
- **AND** no foreign full-content data remains in the client query cache or
  component state

#### Scenario: foreign content is purged on identity or context change

- **WHEN** foreign records are rendered in "Everyone" and the lead then logs out,
  switches role, switches report, switches product, or has authorization
  downgraded
- **THEN** the fetched foreign full-content data is purged from the query cache,
  component state, and DOM
- **AND** no foreign record text, author name, or foreign chip carries into the
  new context

### Requirement: Slides mode shows own records only regardless of the toggle

The lead slides view MUST render only the signed-in lead's own records and MUST
NOT render any other author's records, regardless of the lead report form's
Record visibility toggle, while keeping the honest Product context health signal.

#### Scenario: lead opens slides on a co-owned product

- **WHEN** a lead opens slides mode for a product they co-own
- **THEN** only the lead's own records appear on the slides
- **AND** the product health still reflects the co-owner's stage status
- **AND** the Record visibility toggle has no effect on the slides

### Requirement: The status-only read is returned only to an authorized caller

The status-only Product context read MUST return data only to a caller who owns a
section in, or has access to, the requested report; a request with an arbitrary or
unrelated `reportId` MUST return no foreign context.

#### Scenario: caller requests an unrelated report

- **WHEN** a lead requests Product context for a `reportId` in which they have no
  section and no access
- **THEN** the read returns no foreign stages, counts, names, or status

#### Scenario: status-only read is scoped to the caller's co-owned products

- **WHEN** a lead with access to the report requests Product context, and the
  report includes a product the lead does NOT co-own
- **THEN** the read returns foreign stages and risk-derived status ONLY for
  products the lead co-owns (shares stage assignments on), keeping the lead
  scoped to their own contribution
- **AND** it returns nothing for a product the lead does not co-own
- **AND** it still returns no item/risk/decision text, counts, or full names

### Requirement: The full-content read is gated by report access and co-ownership

The full-content foreign read MUST return records only to a caller who both has
access to the requested report AND co-owns the product whose foreign records are
requested; an unrelated or arbitrary `reportId`, or a product the caller does not
co-own, MUST return no foreign records, even for an otherwise-authorized lead.

This gate applies to ALL callers with NO head/admin bypass: a head or admin who
does not co-own the product MUST be denied (empty), exactly like any other
non-co-owner. The server authorization MUST NOT depend on the lead-form-only
toggle; the toggle gates only whether the request is issued, never whether it is
authorized.

#### Scenario: head or admin who does not co-own the product is denied

- **WHEN** a head or admin requests the full-content foreign read for a product
  they do not co-own
- **THEN** the read returns no foreign records, names, or stage chips

#### Scenario: caller requests full content for an unrelated report

- **WHEN** a lead requests the full-content foreign read for a `reportId` in which
  they have no section and no access
- **THEN** the read returns no foreign records, names, or stage chips

#### Scenario: caller requests full content for a product they do not co-own

- **WHEN** a lead with access to the report requests full content for a product
  they do not co-own
- **THEN** the read returns no foreign records for that product
