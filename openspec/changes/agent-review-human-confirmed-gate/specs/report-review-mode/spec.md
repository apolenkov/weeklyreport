# report-review-mode Specification

## ADDED Requirements

### Requirement: The Report Body Splits Into Review Mode And Normal Mode

The live report body MUST offer two modes. In **review mode** the detailed
reviewer affordances — the per-record comment composer (`record-comments.tsx`)
and the per-section verdict control (`section-verdict-control.tsx`) — are
present; in **normal mode** the body renders read-only report content as before,
with those affordances hidden. The mode toggle MUST be available only to a
session that can review at least one section (a designated reviewer, head, or
admin), and MUST default to **normal mode** so a reader is never dropped into the
review chrome unasked. Grounded in HF9.

#### Scenario: Normal mode hides the review affordances

- **GIVEN** a head opens the live report at `/head/report` with review mode off
- **WHEN** the report body renders
- **THEN** no per-record comment composer and no Approve / Request-changes
  verdict control appear, and the assembled report reads exactly as before

#### Scenario: Review mode surfaces the review affordances

- **GIVEN** a designated reviewer viewing the live report
- **WHEN** they switch the report body to review mode
- **THEN** the per-record comment composer and the per-section verdict control
  render for the sections they may review

#### Scenario: A non-reviewer never sees the mode toggle

- **GIVEN** a session that cannot review any section (a plain viewer with
  `canReview = false` on every accessible group)
- **WHEN** the report body renders
- **THEN** the review-mode toggle is absent and the body stays in normal mode

### Requirement: Review Mode Never Hides The Always-On Header Placeholders

The review-mode/normal-mode split MUST be scoped to the in-body review
affordances (comments and verdicts) only. It MUST NOT gate the always-on
`AgentReviewComingSoon` header placeholder that the `deferred-feature-pattern`
capability requires on every on-screen report-content surface. The placeholder
MUST stay visible in both modes so the two requirements never contradict.

#### Scenario: Header placeholder is present in normal mode

- **GIVEN** the report body in normal mode
- **WHEN** the surface renders
- **THEN** exactly one `AgentReviewComingSoon` header control is present, as
  required by `deferred-feature-pattern`

#### Scenario: Header placeholder is present in review mode

- **GIVEN** the report body in review mode
- **WHEN** the surface renders
- **THEN** the same single `AgentReviewComingSoon` header control is still
  present, unaffected by the mode

### Requirement: The Section-Reviews Strip Lives On The Head Dashboard

The Section-reviews strip (`section-review-strip.tsx`) MUST render on
`/head/dashboard`, merged into the dashboard's review area, and MUST NOT be
rendered inside the live report body. Relocating a head-only surface off the
report body removes the duplication called out in HF3 while keeping the head's
at-a-glance roll-up of every section's review state on the dashboard.

#### Scenario: The head dashboard shows the strip

- **GIVEN** a head opens `/head/dashboard` for a live period with submitted
  sections
- **WHEN** the dashboard renders
- **THEN** the Section-reviews strip appears in the dashboard's review area,
  one row per reviewable section with its author, status, and verdict state

#### Scenario: The live report body no longer renders the strip

- **GIVEN** the same head opens the live report at `/head/report`
- **WHEN** the report body renders
- **THEN** no duplicate Section-reviews strip appears inside the report body

### Requirement: A Designated Viewer-Reviewer Keeps A Verdict Home

The in-report review mode MUST carry the per-section verdict control for a
designated reviewer, because the Section-reviews strip has moved onto the
head-only dashboard, so a viewer who holds `canReview = true` for a group can
still record a verdict on that group's sections without a head dashboard they
cannot reach. The
control MUST enforce the same reviewer designation the server checks
(`isDesignatedReviewer`) and MUST NOT expose any publish or lock affordance.

#### Scenario: A viewer-reviewer records a verdict in review mode

- **GIVEN** a viewer with `canReview = true` for group A opens the live report in
  review mode
- **WHEN** they act on a submitted section belonging to group A
- **THEN** the Approve / Request-changes verdict control is available and posts a
  verdict, and no publish or lock control is shown

#### Scenario: A viewer without the flag sees no verdict control

- **GIVEN** a viewer with `canReview = false` for group B opens the live report
- **WHEN** the review mode (if reachable) renders a group-B section
- **THEN** no verdict control is offered for that section
