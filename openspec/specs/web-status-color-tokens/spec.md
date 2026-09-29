# web-status-color-tokens Specification

## Purpose

Define complete semantic tokens for report-workflow status colors so every status surface resolves through named tokens without inline or fallback colors.

## Requirements

### Requirement: The web status token set is complete for the presentation layer

The design-system token block MUST define a named CSS token for every
report-workflow status color the web presentation layer renders, so the status
presentation layer reads a token contract and never falls back to an inline
literal. This set MUST cover the at-risk fill/foreground, the blocked fill/foreground,
the on-track fill/foreground, the at-risk dot, and a `--color-border-subtle` hairline
token for the subtle card/table borders the status surfaces use. A new report-workflow
status color MUST extend this set with a named token rather than introduce a literal.

#### Scenario: the presentation layer resolves a status color

- **WHEN** a report-workflow status surface renders an at-risk, blocked, or
  on-track fill, foreground, dot, or subtle border
- **THEN** every one of those colors resolves through a token named in the
  design-system token block
- **AND** no report-workflow status color the presentation layer renders lacks a
  named token

#### Scenario: the subtle-border token is defined

- **WHEN** the design-system token block is read
- **THEN** it defines `--color-border-subtle` at `rgba(0,0,0,0.08)`
- **AND** in-scope status surfaces with that exact hairline reference
  `var(--color-border-subtle)`; the `rgba(0,0,0,0.07)` and
  `rgba(0,0,0,0.10)` variants remain separate semantic values

### Requirement: Status token references carry no hex fallback

A web token reference for a status color MUST be written as `var(--color-…)` with
no trailing hex fallback, because a `var(--color-…, #hex)` fallback silently masks
whether the base token is defined and can pin a callsite to the wrong color. The
saved-state checkmark stroke MUST resolve the green foreground token, not the
pale `--color-success` fill.

#### Scenario: a status token is referenced

- **WHEN** the web source is grepped for the `var(--color-…, #hex)` fallback form
  on a status color reference
- **THEN** there are zero matches in `apps/web/src`
- **AND** every callsite references the bare `var(--color-…)` token

#### Scenario: the save-now checkmark renders

- **WHEN** the save-now button renders its "saved" checkmark
- **THEN** the stroke color resolves the green foreground token
  `--color-success-foreground` (#006241), not the pale `--color-success` fill
- **AND** the reference carries no `#16a34a` fallback

### Requirement: Report-workflow status surfaces resolve color through named tokens

The report-workflow status surfaces MUST draw their at-risk / blocked / on-track
fill, foreground, and dot from the named status tokens, never from a raw hex
literal. These surfaces are the risk severity pill (`risk-card`), the risk-entry
severity options (`risk-edit-dialog`), the portfolio-overview status cells
(`portfolio-overview-table`), the lead-form blocked accent (`lead-form`), the
lead-history severity chip and dot (`lead-history-list`, `lead-history-sidebar`),
the stage-hint amber (`meta-row`, `item-card-stage-tags`), the product-accordion
"At risk" pill (`product-accordion`), and the dashboard blocked/at-risk severity
badge (`blocked-at-risk-product-card`). Every at-risk foreground on these
surfaces MUST resolve through the single canonical
`--color-status-at-risk-fg`. Blocked report surfaces resolve through
`--color-destructive`; admin-only red values belong to their separate domain.

#### Scenario: a risk severity pill renders

- **WHEN** the risk card, the risk-entry dialog, the portfolio-overview table, or
  the lead-history list renders an at-risk or blocked severity
- **THEN** its fill, foreground, and any dot resolve through named status tokens
- **AND** no raw at-risk/blocked hex literal remains at that callsite

#### Scenario: the same status renders one canonical color

- **WHEN** the at-risk foreground renders across the risk card, the portfolio
  table, and the lead-history chip
- **THEN** all three resolve the single canonical `--color-status-at-risk-fg`
  - **AND** all three resolve the same canonical token

### Requirement: Non-workflow color domains stay out of the status tokens

Colors that are NOT report-workflow status MUST NOT be folded into the
`--color-status-*` tokens, so a later shift of a status hue cannot silently drag an
unrelated surface with it. The admin role-identity badges (`users-tab`), the
period-lifecycle and reopened tags plus the required-field asterisk and
destructive-action reds (`periods-tab-*`, `periods-delete-confirm-dialog`), the
publish-lock pending-leads warning (`publish-lock-button`), the decision "Due"
deadline chip (`decision-card`) belong to separate color domains. The publish-lock warning and the
decision deadline chip reuse the amber palette but signal a warning or an
approaching deadline, not report-workflow at-risk status, so they stay in
their own domain. Any recolor of those domains is a separate concern.

#### Scenario: a role-identity badge is left unchanged

- **WHEN** a report-workflow surface resolves a status token
- **THEN** the admin role-identity badge is not remapped to `--color-status-*`
- **AND** the period-lifecycle tags, the required-field asterisk, the
  destructive-action reds, the publish-lock pending-leads warning, and the
  decision "Due" deadline chip are left to their own domain
