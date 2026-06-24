# head-toolbar-semantics Specification

## MODIFIED Requirements

### Requirement: Header utility actions carry visible text labels

Head-report-header utility links MUST render a visible text label next to
their icon ("Present", "Print") — icon-only rendering is not allowed for the
actions that navigate to a distinct surface (the `/head/report/[id]/present`
link and the `/print/[reportId]` link). Labels MUST honestly name the surface:
the browser-print template is labeled "Print", not "Export PDF" or "Print PDF".

The slides-mode "Open focused report" drill-into-a-lead link is removed
(head-surface-uat-polish F1): it duplicated the deck's own slide navigation. In
its place the slides-mode header MUST host the same Publish & Lock / Reopen
period action the edit mode offers (gated to head/admin), alongside the
Export-PDF document action, so the head can lock a period straight from the
review deck. No "Open focused report" link renders anywhere in slides mode.

#### Scenario: utility links render

- **WHEN** the head report header renders the presentation and print
  links
- **THEN** each shows its icon plus a visible text label
- **AND** the print link is labeled "Print" (distinct from the
  publish-gated "Export PDF" action)

#### Scenario: slides mode replaces the focused-report link with Publish & Lock

- **WHEN** the head views the report in `?mode=slides`
- **THEN** no "Open focused report" link renders on the header line or in the
  deck body
- **AND** the Publish & Lock / Reopen action renders on the header line for a
  head/admin, beside the Export-PDF document action
