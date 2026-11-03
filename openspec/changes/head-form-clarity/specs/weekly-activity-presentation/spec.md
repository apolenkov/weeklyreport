## ADDED Requirements

### Requirement: Head Activity details preserve typed record depth

The `/head/report/[reportId]` form MUST offer expandable Activity details with the same reading depth as Product records: individual Current/Next progress, priority and next commitment where present, risk severity/problem/impact/mitigation, and decision text. Records MUST retain author, section and record identity. Activity health MUST remain independent of linked Products.

#### Scenario: An Activity contains all record types

- **WHEN** Head expands an Activity with Current and Next items, a risk and a decision
- **THEN** all four typed groups show their complete authorized fields rather than text-only summaries
- **AND** item outcomes and outcome history remain readable where present, without authoring controls
- **AND** the Activity header retains effective weekly title, weekly note (the activity description), derived health and linked Product names

#### Scenario: One Activity links to two Products

- **WHEN** an Activity has two linked Products and appears in Product or Leads scope
- **THEN** each section's Activity contribution appears exactly once in that scope, not repeated beneath linked Products
- **AND** neither linked Product's health changes because the Activity is blocked

#### Scenario: Activity details are disclosed with a keyboard

- **WHEN** Head opens the form at 375 or 1280 CSS pixels
- **THEN** Activity summaries start compact, their controls expose accurate expanded state and controlled-region identity, and activation reveals full details inline
- **AND** collapsed detail controls are not focusable and expanded content does not cause document-level horizontal overflow

### Requirement: Head Activity records reuse authorized review interactions

In Review on `/head/report/[reportId]`, Activity items, risks and decisions MUST expose existing comments and eligible comment actions against their original record anchors, with distinct accessible names. Read MUST show no review composers. Submission filtering, lifecycle and server capabilities MUST apply exactly as for Product records; Activity expansion MUST NOT grant permissions or write report content.

#### Scenario: Head comments on an Activity risk

- **WHEN** Head enters Review and comments on an eligible Activity risk
- **THEN** the comment targets that risk ID, not the Activity status or a linked Product
- **AND** the existing pending, validation, error recovery, deletion ownership and report-scoped comment-draft behavior applies
- **AND** two risks with identical problem text still have distinguishable comment controls

#### Scenario: Activity-only draft is hidden

- **WHEN** the report defaults to Submitted and an author's only content is a draft Activity
- **THEN** its records remain hidden and count toward the existing draft-hidden signal
- **AND** Show all reveals them without granting a section verdict to the draft

#### Scenario: A published Activity is inspected

- **WHEN** Head expands an Activity in a published or archived report
- **THEN** it reads the authorized report source with frozen presentation where applicable and no review mutation controls
- **AND** no catalogue lookup replaces frozen labels or restores excluded review comments

## MODIFIED Requirements

### Requirement: Unavailable activity details preserve saved records

The Head report activity overview MUST display saved activity-backed records whose activity details are absent from the section read model in an explicitly labeled unavailable-details group. It MUST NOT invent an activity name or status, omit those records, or include product-only records in that group. Its expandable typed records MUST preserve the same reading and authorized review depth as available Activity records.

#### Scenario: An activity is detached after records were saved

- **WHEN** a Lead saves activity-backed current and next items, risks, or decisions and an administrator detaches that activity from the Lead
- **THEN** the Head report overview retains the saved records under their section author with an unavailable-details label
- **AND** records with available activity details remain in their existing activity group without duplication
- **AND** expanding the unavailable-details group preserves record IDs, individual progress, complete risk fields and eligible record comments
