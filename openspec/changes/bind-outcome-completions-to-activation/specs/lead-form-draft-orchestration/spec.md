## ADDED Requirements

### Requirement: Lineage responses MUST belong to the issuing section activation

Resolve and restore completions MUST update the local version, draft, and saved
baseline only while their issuing command owns the current section activation.
Changing sections or unmounting MUST invalidate that ownership. Returning to
the same section MUST NOT reactivate an old command. A refreshed read within
the same activation MUST retain valid command ownership and existing version
checks. Server command identity and explicit retry semantics MUST remain unchanged.

#### Scenario: A lineage response arrives after changing sections

- **GIVEN** resolve or restore starts on section A
- **WHEN** section B becomes active before the response arrives
- **THEN** the response changes neither the local version nor the adopted section

#### Scenario: The form returns before its old lineage response arrives

- **GIVEN** resolve or restore starts on A and navigation activates B and then A
- **WHEN** the original command completes
- **THEN** it does not update the version, draft, or saved baseline of the new A activation

#### Scenario: A lineage owner unmounts before completion

- **GIVEN** resolve or restore is pending when its form owner unmounts
- **WHEN** the response arrives
- **THEN** it does not invoke local version acceptance or server-section adoption

#### Scenario: The current activation receives a refreshed read

- **GIVEN** resolve or restore is pending and a read refreshes the same active section
- **WHEN** the response arrives without leaving that activation
- **THEN** existing version checks permit adoption of the valid response
