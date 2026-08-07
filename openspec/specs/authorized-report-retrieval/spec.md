# authorized-report-retrieval Specification

## Purpose

TBD - created by syncing add-native-lead-report-assistant.

## Requirements

### Requirement: A strict SearchPlan expresses user intent without internal controls

`@customreport/shared` MUST implement the exact strict `SearchPlan` wire contract in `docs/llm-report/lead-report-assistant-search-plan-contract.md`, including its field names, enum literals, requiredness, explicit no-filter values, bounds and cross-field rules. It MUST own the Zod schemas and inferred types for report periods, authors, subjects, stages, record kinds, item/risk/decision/status filters, retrieval mode, output mode, grouping, requested limit, and exhaustive intent. Every tool field MUST be explicit; no SearchPlan field MUST use a silent default. Similarity thresholds, vector dimensions, candidate limits, database IDs, clarification tokens, and ACL decisions MUST NOT be tool parameters.

#### Scenario: Planner emits the documented no-filter shape

- **WHEN** a filter dimension is absent from user intent
- **THEN** the plan uses the contract's explicit empty-array or null representation
- **AND** the server does not infer a hidden model-controlled default

#### Scenario: Decision filters are requested

- **WHEN** the user asks for open, resolved, overdue, due-today, upcoming, on-time, late, or deadline-less decisions
- **THEN** the plan uses the documented assistant-owned Decision classification
- **AND** the server derives it from `resolvedAt`, `deadline`, trusted server date, and configured timezone without adding persisted Decision state

#### Scenario: Structured intent has no semantic residual

- **WHEN** a plan selects `structured` retrieval
- **THEN** schema refinement requires `semanticQuery` to be null

#### Scenario: Semantic intent includes a residual concept

- **WHEN** a plan selects `semantic_ranked` retrieval
- **THEN** schema refinement requires a non-empty residual semantic query and at least one semantic-capable record kind

### Requirement: Period resolution selects exactly one canonical source per report

The report search repository MUST read the current editable `open` or `reopened` report from live report-section data and MUST read published history from parsed immutable `Report.publishedSnapshot` sections. A report occurrence MUST NOT combine live and snapshot content. Unless the user specifies another range, the assistant MUST search the current editable report plus the three latest published reports.

#### Scenario: Default range is available

- **WHEN** a Lead asks a report question without specifying a period range
- **THEN** retrieval selects the current editable report and at most three latest published snapshots

#### Scenario: Four published reports are requested

- **WHEN** a Lead asks for the last four published reports without including the current draft
- **THEN** retrieval selects four published snapshots and excludes the current live report

#### Scenario: Published live rows drift after publication

- **WHEN** a published report's live rows differ from its frozen snapshot
- **THEN** assistant retrieval returns the frozen snapshot content only

### Requirement: Lead authorization is applied before candidate projection

The structured retriever MUST default author scope to the current Lead. The Lead's own section MAY expose its authorized product- and activity-parented content. Every foreign section MUST require the caller to own a section in that report and to currently share at least one non-archived product with the target author, then MUST pass through the existing `filterSectionToSharedProducts` policy before any `SearchCandidate` is created.

#### Scenario: Lead searches an own activity note

- **WHEN** the selected report contains the Lead's own attached activity with a note
- **THEN** the note may become an authorized Activity-status candidate

#### Scenario: Lead searches a foreign co-owner section

- **WHEN** the Lead and target author currently share a non-archived product and the caller owns a section in the selected report
- **THEN** retrieval exposes only product-parented records and statuses for currently shared products
- **AND** it omits foreign activities, activity-parented records, notes, comments, reviews, paused reasons, unshared products, and decisions without an accessible product parent

#### Scenario: Lead lacks foreign report access

- **WHEN** a foreign author exists but the caller lacks an own section in that report or current shared-product ownership
- **THEN** the author and their content are absent from candidates and clarification options
- **AND** the outcome does not reveal whether the inaccessible author exists

### Requirement: New snapshots retain Activity Jira aliases compatibly

The shared `sectionActivitySchema` MUST carry `jiraAccounts` so newly published snapshots freeze Activity aliases. The schema MUST continue parsing historical snapshots that predate the field as an empty list.

#### Scenario: A new report is published with Activity aliases

- **WHEN** an Activity with Jira accounts is included in a published snapshot
- **THEN** the snapshot preserves those aliases for future accessible entity resolution

#### Scenario: An old snapshot has no Jira aliases field

- **WHEN** the assistant parses a historical snapshot without `jiraAccounts`
- **THEN** parsing succeeds with an empty alias list

### Requirement: Candidate projection is immutable and non-persistent

After source selection and authorization, a pure projector MUST create a discriminated `SearchCandidate` union for Item, Risk, Decision, Product status, Stage status, and Activity status. Candidate occurrences MUST retain report, section, author, subject, period, record identity, and optional lineage identity. Candidate projection MUST NOT persist a search-document copy of report text and MUST NOT deduplicate carry-over occurrences across reports.

#### Scenario: A carried Item appears in four reports

- **WHEN** one lineage appears as four authorized report occurrences
- **THEN** projection produces four distinct candidates with the shared lineage retained separately

#### Scenario: A foreign section reaches projection

- **WHEN** projection receives a foreign visible section occurrence
- **THEN** that occurrence has already passed the shared-product lens and contains no private foreign fields

### Requirement: Exact filters precede and bound every semantic operation

The structured retriever MUST apply authorized reports, section scopes, subjects, stages, record kinds, item filters, risk severity, decision state/timing, canonical health, carry-over, and priority filters before semantic ranking. Values within one dimension MUST combine as OR; dimensions MUST combine as AND. Semantic ranking MUST NOT add, recover, or query candidates outside the exact result.

#### Scenario: Exact filters return no candidates

- **WHEN** the authorized structured filters produce an empty set
- **THEN** retrieval returns `no_results` without requesting an embedding
- **AND** it does not broaden a period, author, product, kind, or status filter

#### Scenario: Vector storage contains another accessible-looking hash

- **WHEN** pgvector contains an embedding whose hash is not in the current exact candidate set
- **THEN** that row is excluded from ranking and cannot appear in the answer

### Requirement: Semantic content is deliberately narrow

Embeddings MUST be built only from Item text; Risk risk, impact, and mitigation; Decision text and impact; and Activity name plus a non-empty note. Product status, Stage status, and Activity status without a note MUST NOT receive embeddings. Author, product, and stage names MUST NOT be appended to record embedding text.

#### Scenario: Product status is requested by exact subject

- **WHEN** a Lead asks for a product's status without a semantic topic
- **THEN** the plan uses structured retrieval and returns the derived status fact without a vector lookup

#### Scenario: Semantic records need supporting status

- **WHEN** semantic ranking finds textual records for a product or stage
- **THEN** ContextBuilder may attach authorized exact status facts as supporting context without assigning them a fabricated similarity score

### Requirement: Aggregation and output limits are deterministic

The server MUST compute counts, comparisons, grouping, and status summaries over the complete retrieved set before evidence truncation. Structured and semantic ordering MUST have stable tie-breakers. Ordinary bounded answers MUST report truncation explicitly; an exhaustive request or semantic candidate set beyond its hard limit MUST return `result_set_too_large` rather than silently omit candidates.

#### Scenario: Count exceeds the answer context budget

- **WHEN** the complete authorized result contains more records than can be sent as answer evidence
- **THEN** the reported count still reflects the complete set

#### Scenario: Explicit show-all exceeds the hard limit

- **WHEN** the Lead requests exhaustive output beyond the configured maximum
- **THEN** the assistant returns `result_set_too_large` and requests narrower filters
