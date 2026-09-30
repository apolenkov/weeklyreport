# developer-ui-feedback-tooling Specification

## Purpose

Defines how developers review UI in WeeklyReport and Development through the shared user-level onUI interface, canonical page origins, and evidence-bound annotation closure.

## Requirements

### Requirement: Active repositories MUST share one external onUI review interface

Developer visual review for `/home/user/work/Development` and `/home/user/work/weeklyreport` MUST use the user-level `onui-local` MCP interface and browser extension. Neither repository MUST include onUI application dependencies, source, or distributable artifacts. WeeklyReport's authenticated Agentation product dependency and PostgreSQL adapter are a separate product capability and MUST remain governed by `authenticated-product-feedback`.

#### Scenario: WeeklyReport starts a visual review

- **WHEN** an agent begins UI work from an onUI annotation
- **THEN** it reads the user-level `onui-local` tools without importing a review package into the application
- **AND** the production dependency graph remains unchanged by the review tooling

### Requirement: Page identity MUST use canonical origins

Development acceptance MUST use `http://127.0.0.1:4177`; WeeklyReport acceptance MUST use `http://localhost:3000`. Evidence from another hostname, port, path, or query MUST NOT be counted without explicitly mapping it to the canonical page.

#### Scenario: The same page is opened through an alternate hostname

- **WHEN** onUI lists both `localhost` and `127.0.0.1` records for one application
- **THEN** the records remain separate
- **AND** only the repository's canonical origin enters its acceptance denominator

### Requirement: Annotation handling MUST be evidence-bound

Before editing from onUI feedback, the agent MUST list pages, read the relevant annotations at Standard detail by default, and state its interpretation with annotation IDs. Ambiguous intent MUST be clarified in chat. An annotation MUST remain open until its literal requirement is tied to changed sources, an applicable automated check, and browser verification.

#### Scenario: An annotation target or intent is ambiguous

- **WHEN** the current DOM does not prove the intended target or outcome
- **THEN** the agent asks one concise question in chat naming the annotation ID
- **AND** it does not overwrite, resolve, dismiss, or delete the annotation while ambiguity remains

#### Scenario: A fix is fully verified

- **WHEN** source, automated, and browser evidence all prove the literal requirement
- **THEN** the annotation may be marked resolved or deleted under the user's instruction
- **AND** that metadata change does not alter any product review or report lifecycle state

### Requirement: Legacy local Agentation tooling retirement MUST be exact and intentional

The migration MUST remove only the retired user-level Agentation runtime, MCP integration, and exact local data directory `~/.agentation` without archive or import. It MUST preserve WeeklyReport's authenticated Agentation widget, application dependency, PostgreSQL adapter, and durable product data. Historical repository documents MUST remain unchanged and MUST NOT count as active user-level tooling.

#### Scenario: The dormant local store is retired

- **WHEN** read-only checks prove no legacy user-level Agentation process, MCP registration, launch service, global package, or local SQLite consumer exists
- **AND** `~/.agentation` contains only the known SQLite store files
- **THEN** that exact directory is deleted
- **AND** absence of the directory is verified afterward

### Requirement: Tooling rollback MUST not affect product state

Rollback MUST be limited to WeeklyReport agent guidance and the user-level onUI registration/source. It MUST NOT mutate product data, repository history, Development's dirty worktree, or WeeklyReport lifecycle state.

#### Scenario: onUI must be rolled back

- **WHEN** the pinned onUI installation fails acceptance
- **THEN** the prior agent guidance is restored and `onui-local` is removed or re-registered
- **AND** no product deployment or database rollback is required
