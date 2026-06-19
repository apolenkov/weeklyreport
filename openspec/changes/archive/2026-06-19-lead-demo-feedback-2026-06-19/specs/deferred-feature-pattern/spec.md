## ADDED Requirements

### Requirement: Every ComingSoon tooltip anchors its badge identically across controls

Every tooltip-anchored ComingSoon control MUST position its `ComingSoonBadge` through one shared anchor class that centres the badge under the control, so the badge sits identically regardless of the control's width (icon-only vs text-labelled).

1. The shared anchor MUST centre the badge horizontally on the control
   (`left-1/2 -translate-x-1/2`); no tooltip-anchored control may right-align it
   with `right-0`.
2. All tooltip-anchored ComingSoon controls — agent-review, lead version, lead
   PDF-export, nav theme, nav language, and admin holidays — MUST consume the same
   anchor constant rather than each repeating the class string.
3. Inline (non-tooltip) `ComingSoonBadge` usages — the static admin integration
   row badges — are NOT tooltip anchors and are out of scope for this rule.

#### Scenario: The wide text-labelled control anchors like the icon-only ones

- **WHEN** a user hovers the text-labelled agent-review ComingSoon control and any
  icon-only ComingSoon control
- **THEN** both badges are centred under their control via the same anchor class
- **AND** neither badge uses the `right-0` right-aligned anchor
