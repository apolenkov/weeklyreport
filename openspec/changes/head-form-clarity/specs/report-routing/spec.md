## MODIFIED Requirements

### Requirement: The authorId deep-link scroll target matches the highlighted panel

Ordinary weekly-report `?authorId=<id>` deep-links MUST resolve the scroll target to the same visible product as the highlighted/expanded accordion panel using the same content filter. Head Review links in Leads scope and Product review-roster navigation MUST instead scroll and focus the owning rendered author section, suppressing the Product-scroll request. Both mechanisms MUST use smooth scrolling by default and immediate `auto` scrolling when `prefers-reduced-motion: reduce` is reported.

#### Scenario: First authored product is empty, a later one has content

- **GIVEN** an ordinary author deep-link whose first authored product has no content and a later authored product does
- **WHEN** the weekly-report page renders
- **THEN** the content-bearing highlighted/expanded product receives the scroll request, not the empty first one

#### Scenario: Reduced motion keeps the author deep-link deterministic

- **WHEN** an ordinary author deep-link resolves to a visible product panel
- **THEN** the panel scrolls with `auto` under reduced motion and `smooth` otherwise

#### Scenario: Review targets the section rather than a competing Product panel

- **WHEN** an eligible targeted Head Review link or Product review-roster link opens Leads scope
- **THEN** the owning author region receives focus and the sole delayed scroll request
- **AND** no Product panel competes for scroll, including when the author has both Product and Activity content

### Requirement: Author targets belong to displayed scope-specific products

Ordinary author deep-links MUST select a Product from the displayed Product collection or the focused author's displayed Leads group. Highlight and delayed Product scroll MUST use that same rendered instance. Head Review/roster navigation in Leads scope MUST target the visible author region instead; an Activity-only or empty submitted reviewable section is valid without a Product anchor. Hidden or absent author content MUST NOT fabricate a Product or section target. Explicit overview navigation and full report summaries remain unchanged.

#### Scenario: Draft content is hidden by the submission filter

- **GIVEN** an author's only content is draft
- **WHEN** the Submitted body renders in either scope
- **THEN** no hidden draft Product or author region is selected
- **AND** Show all restores visible-content eligibility without granting Review capability

#### Scenario: A co-owner contributes only to a different product

- **GIVEN** Alice contributes to shared Alpha and Bob contributes only to Beta
- **WHEN** an ordinary Bob author link opens Leads scope
- **THEN** Bob's Beta instance is expanded and receives the Product-scroll request, with no nonexistent Bob Alpha target
- **AND** Product scope may select visible aggregate Alpha

#### Scenario: Activity-only Review has no fabricated Product anchor

- **WHEN** eligible Head Review targets an Activity-only author in Leads scope
- **THEN** the rendered author region receives focus without any Product target

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
