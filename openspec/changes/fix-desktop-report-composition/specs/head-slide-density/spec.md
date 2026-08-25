## ADDED Requirements

### Requirement: Hosted density selection belongs to report context chrome

The Head and hosted Lead slide density selections MUST remain reversible between Document and Presentation while rendering inside their shared report context toolbars. Moving either control MUST NOT refetch, discard, reorder, or duplicate report records. A standalone Lead deck MAY retain its own density control.

#### Scenario: Head switches presentation density

- **WHEN** the Head changes Document to Presentation from the context toolbar
- **THEN** the active deck updates to the selected density without an extra toolbar row
- **AND** all source record identities remain represented exactly once according to the existing density contract

#### Scenario: Lead switches presentation density from report context

- **WHEN** a Lead changes Document to Presentation from the hosted report context toolbar
- **THEN** the active deck updates to the selected density without an extra deck density row
- **AND** fullscreen behavior remains available through the existing report toolbar control
- **AND** all source record identities remain represented exactly once according to the existing density contract

### Requirement: Head Presentation fills the report frame without poster-height waste

The Head Presentation slide frame MUST use the full available inline size of
its desktop report frame rather than a narrower fixed maximum, and MUST use a
tokenized compact minimum block size of `360px` that can grow with its content.
The loading skeleton MUST preserve the same frame geometry so switching from
loading to settled content does not create a layout jump. This correction MUST
not change slide ordering, density semantics, or source-record identity.

#### Scenario: Head opens Presentation at desktop width

- **WHEN** the Head selects Presentation density
- **THEN** the active slide frame spans the available report content width
- **AND** the frame is at least the shared `360px` minimum while remaining auto-sized for taller content
- **AND** the settled frame preserves the loading frame's width and minimum-height contract

### Requirement: Head carousel exposes edge-aware navigation

The Head slide carousel MUST expose explicitly named Previous and Next buttons,
disable Previous on the first slide and Next on the last slide, and keep the
selected card visible when selection changes. The strip MUST use smooth
scrolling and scroll snapping where motion is enabled, with reduced-motion
behavior preserved. Selection visibility MUST adjust only the carousel
viewport's horizontal scroll and MUST NOT request document or vertical
scrolling. The controls MUST reuse the existing selected-index and slide-order
contract without creating duplicate records or slides.

#### Scenario: Head pages through Presentation cards

- **WHEN** the Head activates Next or Previous
- **THEN** the selected index changes by one within the existing slide list
- **AND** the newly selected card is visible in the carousel viewport
- **AND** the corresponding edge control becomes disabled only at the first or last slide
