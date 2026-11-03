## ADDED Requirements

### Requirement: Head view and context labels describe reading accurately

The `/head/report/[reportId]` toolbar MUST label the form destination `Report` and the presentation destination `Slides`, including visible desktop labels, accessible names and tooltips. Its department detail MUST read `Portfolio report` in Read, Review and Slides, without implying a live source or content editing. The lifecycle badge MUST retain Live / Published / Archived precedence and the submission ratio.

#### Scenario: Head reads a published report

- **WHEN** Head opens a published report in the form
- **THEN** the selected destination is Report, no Head view-mode label says Edit, and the department detail says Portfolio report
- **AND** the lifecycle badge says Published rather than Live

#### Scenario: Head reads live or archived content

- **WHEN** Head opens live content, switches Read/Review, or opens an archived report
- **THEN** the form destination remains Report and the department detail remains Portfolio report
- **AND** the badge retains Live or Archived as appropriate, with its submission ratio
- **AND** Lead authoring labels, Viewer labels, routes, permissions and document-action placement remain unchanged
