## ADDED Requirements

### Requirement: Head review deep-links declare intent without granting capability

The `/head/report/[reportId]` form MUST recognize only the single scalar `review=1` as Review intent, separate from the Form/Slides `mode` parameter. With an author target it MUST activate Review only after that target is confirmed submitted and reviewable in the editable, non-archived report; without an author, at least one eligible section is required. Missing, invalid or repeated review values MUST resolve to Read.

#### Scenario: Queue Review enters the selected author's review

- **WHEN** Head follows `/head/report/[reportId]?authorId=[leadId]&scope=lead&review=1` for an eligible submitted author
- **THEN** the form opens Review with Submitted filtering, focuses that author's rendered section and exposes its verdict and record review controls
- **AND** an Activity-only section is a valid author target without a fabricated Product target
- **AND** opening or refreshing the link sends no review mutation

#### Scenario: Review intent is stale or unauthorized

- **WHEN** a review link targets a draft, absent or unauthorized author, or a published or archived report
- **THEN** the form remains Read without revealing hidden drafts or granting review controls
- **AND** it shows `Review is unavailable for this section.` for an author target or `Review is unavailable for this report.` without one
- **AND** no alternative author's eligibility silently authorizes the targeted section

#### Scenario: Plain Open and malformed intent retain defaults

- **WHEN** Head follows a link without review intent, with `review=0`, with an unknown value, or with repeated review keys
- **THEN** the form starts Read with its existing submission-filter default
- **AND** a draft author remains hidden until the explicit Show all action

### Requirement: Review URL state follows deliberate navigation

On `/head/report/[reportId]`, selecting Read MUST remove `review` and selecting eligible Review MUST set `review=1`. Refresh and browser history MUST restore that URL-selected mode subject to current gates. Same-report scope/archive-filter and Report/Slides navigation MUST preserve valid review intent and author context; selecting another period MUST clear review intent. Slides MUST NOT mount review mutation controls.

#### Scenario: Head explicitly returns to Read

- **WHEN** Head switches Review to Read and then refreshes or navigates back and forward
- **THEN** the mode follows each history entry's review intent without a stale local initializer overriding it
- **AND** an unrelated query update cannot re-enable Review after Read removed the intent

#### Scenario: Head changes view or period

- **WHEN** Head switches Report to Slides and back for the same report
- **THEN** eligible review intent and author context survive without review controls in Slides
- **WHEN** Head selects another period
- **THEN** the new period starts Read with no inherited review intent
