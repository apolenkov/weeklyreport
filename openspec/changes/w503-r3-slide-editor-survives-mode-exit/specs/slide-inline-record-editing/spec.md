## ADDED Requirements

### Requirement: An open slide editor survives leaving Slides mode

An open Slides inline editor (edit dialog or delete confirmation) MUST NOT be
closed, and its typed values MUST NOT be discarded, because the lead form leaves
Slides mode (for example browser Back removing `?mode=slides`). The lead form MUST
keep the editor's deck mounted but hidden until the editor closes by Save, Delete,
Cancel or a section change. With no editor open, leaving Slides mode MUST unmount
the deck.

#### Scenario: Back from Slides keeps the typed risk edit

- **GIVEN** a lead has the Slides risk editor open with unsaved typed text
- **WHEN** the URL leaves Slides mode through browser Back
- **THEN** the editor dialog remains open with the typed text
- **AND** the Report view renders behind it

#### Scenario: Cancelling after leaving Slides ends the hold

- **GIVEN** the editor was kept open after leaving Slides mode
- **WHEN** the lead cancels the dialog
- **THEN** the dialog closes and no Slides deck remains mounted

#### Scenario: Leaving Slides without an editor unmounts the deck

- **GIVEN** no Slides editor is open
- **WHEN** the URL leaves Slides mode
- **THEN** the Slides deck is not rendered
