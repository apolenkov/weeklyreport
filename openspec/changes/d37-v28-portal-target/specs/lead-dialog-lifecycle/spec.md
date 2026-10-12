## ADDED Requirements

### Requirement: Lead deck dialogs wait for their owned portal target

On the public Lead report Slides surface, a dialog owned by the deck MUST wait
for its deck container before mounting portaled content. Resolving that
container MUST NOT first mount the content in the document body and remount it
inside the deck. Dialogs outside a deck-owned portal context MUST retain their
existing document-body placement and server-rendering behavior.

#### Scenario: A dialog is present during the initial deck mount

- **GIVEN** a Lead Slides deck with dialog content during its initial mount
- **WHEN** its portal container resolves from the mounted deck
- **THEN** that content mounts once inside the deck container
- **AND** it is never first mounted as a document-body child

#### Scenario: A dialog has no deck-owned portal context

- **WHEN** a dialog outside the deck renders and hydrates
- **THEN** its server markup remains empty
- **AND** its client content mounts in the document body without a hydration mismatch
