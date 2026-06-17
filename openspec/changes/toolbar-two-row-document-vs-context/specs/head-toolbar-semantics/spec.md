## MODIFIED Requirements

### Requirement: Segmented toggles in the head report header share one visual family

The segmented controls MUST render as one visual family wherever they sit — whether in the head report header or in the report toolbar's bottom Context control row introduced by the two-row layout.

`ScopeToggle` (`apps/web/src/components/report-shell/scope-toggle.tsx`) and
`ViewModeToggle` (`apps/web/src/components/report-shell/view-mode-toggle.tsx`),
composed by `apps/web/src/components/head/head-report-shell.tsx`, MUST share the
same brand active-fill token (`--color-starbucks-accent`, white active text),
the same font size tier (`text-sm` semibold), and the same pill shape, and MUST
be visually identical so the head and lead toolbars read as one control family.
Group separation MUST be carried by wrapper border/spacing, not by divergent
control styling. A new segmented control MUST adopt the same family. The
two-row layout relocates these toggles into the Context control row; the active
selection fill remains the accent token and is exempt from the "no brand-accent
in the bottom row" rule because it marks selection, not a commit.

#### Scenario: the toggles render in the context row as one family

- **WHEN** the report toolbar renders the scope toggle and the view-mode toggle
  in the Context control row
- **THEN** both use the brand green active-fill token, font size, and pill shape
- **AND** the two toggles are visually identical, separated only by wrapper
  spacing

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder MUST render visually subordinate to real actions — compact — and MUST be positioned at the leading edge of its control group, whether that group is the head report header or the report toolbar's Context control row.

Today this placeholder is `AgentReviewComingSoon`
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`). The inert
ComingSoonBadge pattern (aria-disabled, no click handler, tooltip) MUST be
preserved. Under the two-row layout it renders in the Context control row,
compact and at the leading edge of that group.

#### Scenario: the context row renders a deferred placeholder

- **WHEN** the report toolbar's Context control row renders the Agent review
  placeholder alongside real context controls
- **THEN** the placeholder is compact (smaller than the real actions) and is the
  first element of the group
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip

## REMOVED Requirements

### Requirement: The word "Publish" appears on exactly one header control

**Reason**: The two-row layout moves the publish action out of the page header
row into the Document-action toolbar row, so the requirement can no longer be
scoped to "one header control". It is replaced by the location-agnostic
"appears on exactly one head control" requirement below, which keeps the
exactly-one-control invariant while allowing the control to render in either
the header row or the document-action row.

**Migration**: No behavioural change — `PublishLockButton` is still the only
control whose visible label carries "Publish"; only the requirement's wording
generalises from "header control" to "head control, wherever it renders".

## ADDED Requirements

### Requirement: The word "Publish" appears on exactly one head control

The word "Publish" MUST appear on exactly one control across the head report surface — the publish action (`PublishLockButton`) — regardless of whether it renders in the page header row or in the document-action toolbar row; no other control's visible label MAY carry it.

The Export-PDF control
(`apps/web/src/components/weekly-report/export-pdf-button.tsx`) renders as a
compact 32px icon button carrying its name via `aria-label`/tooltip, not a
visible text label; its unpublished precondition is conveyed by the disabled
state plus an `aria-describedby`/sr-only hint, NOT by a compound label
containing "Publish".

#### Scenario: unpublished period renders the export button

- **WHEN** the period status is `open` and the export icon button renders disabled
- **THEN** it exposes its accessible name "Export PDF" via `aria-label`/tooltip
- **AND** the publish precondition is available via an `aria-describedby`/sr-only
  hint, not by changing the tooltip text
- **AND** only the publish action's visible label contains the word "Publish",
  wherever that action renders
