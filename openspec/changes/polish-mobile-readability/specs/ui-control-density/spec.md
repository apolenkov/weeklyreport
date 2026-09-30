## ADDED Requirements

### Requirement: Meaningful interface text has a readable size and contrast

Meaningful visible text on interactive application screens in `apps/web/src`
and their shared interface components MUST have a computed font size of at
least 12 CSS pixels. This includes user and author identity, metadata, status
labels, counters, stage tags, and legends. The private print/PDF rendering
surface is outside this requirement's scope.
Ordinary meaningful text MUST have a contrast ratio of at least 4.5:1 against
its actual composed background; ancestor opacity and overlays MUST be included
in that measurement. Decorative marks and inactive controls are exempt, but
their persistent explanations MUST remain readable. Text enlargement MUST
NOT introduce clipping, overlapping content, or inaccessible controls.

#### Scenario: A reader inspects secondary report information

- **WHEN** report metadata, initials, status labels, or legends render at 375 or 1440 CSS pixels
- **THEN** meaningful text is at least 12 CSS pixels with at least 4.5:1 contrast
- **AND** no meaningful name is dimmed below the contrast floor merely because its section is empty

### Requirement: Authenticated navigation exposes the signed-in identity on mobile

The shared navigation under `apps/web/src/shared/ui/navigation/` MUST show the
signed-in user's existing display name and role at 375 CSS pixels. Long names
MUST wrap without pushing the Menu, development role-switcher, or Sign out
controls outside the viewport. Navigation actions MUST occupy the trailing
side of the mobile header and preserve their existing accessible names and
keyboard operation. Desktop navigation MUST retain its centered main links.

#### Scenario: Mobile navigation contains a long user name

- **WHEN** a signed-in visitor with a long display name opens an application page at 375 CSS pixels
- **THEN** the name and role remain visible and the navigation actions remain reachable at the right
- **AND** the existing named Menu and Sign out controls remain operable
