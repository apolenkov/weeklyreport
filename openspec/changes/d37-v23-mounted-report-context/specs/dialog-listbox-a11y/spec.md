## MODIFIED Requirements

### Requirement: Popup and expander controls MUST expose accurate ARIA relationships

`QuickAddButton`'s disclosure trigger MUST omit `aria-haspopup` because its
expanded content is a labelled `group`, not one of the popup roles accepted by
that attribute. `AccordionSection`'s toggle controls MUST each carry an
`aria-controls` attribute referencing the panel they expand.

`QuickAddButton` (`apps/web/src/features/report-pages/ui/lead/chrome/quick-add-button.tsx`)
MUST expose the expanded state through `aria-expanded` and the labelled group
relationship. `AccordionSection`
(`apps/web/src/shared/ui/report-shell/accordion-section.tsx`) must wire the
`aria-controls` id on both the header toggle and the trailing icon-button
toggle when both are rendered for the same panel, and that id must resolve
to a stable id on the collapsible panel. A content-bearing `ProductAccordion`
MUST likewise expose one stable toggle-to-region relationship. Its collapsed
content wrapper MUST be both `inert` and `aria-hidden` so its mounted controls
cannot remain interactive or enter the accessibility tree. An empty product
accordion renders no panel and MUST omit `aria-controls` rather than reference
a missing element. The Admin Product stage-assignment and Activity
lead-attachment disclosures MUST also expose a
stable `aria-controls` relationship to a region labelled by the corresponding
toggle. Admin row regions that stay mounted while collapsed MUST report their
hidden state to assistive technology.

#### Scenario: QuickAddButton exposes a group disclosure accurately

- **WHEN** QuickAddButton's popup is inspected via the accessibility tree
- **THEN** the trigger omits `aria-haspopup`, reports `aria-expanded`, and the
  expanded content exposes its labelled `group` role

#### Scenario: An accordion toggle references its panel via aria-controls

- **WHEN** an `AccordionSection` renders both a header toggle and a
  trailing icon-button toggle for the same panel
- **THEN** both toggles carry `aria-controls` set to that panel's id
- **AND** the id resolves to the actual collapsible panel element in the DOM

#### Scenario: A collapsed product report keeps mounted content inaccessible

- **WHEN** a content-bearing product report is collapsed
- **THEN** its toggle references a labelled region through stable
  `aria-controls` and `aria-labelledby` ids
- **AND** the region's immediate content wrapper is `inert` and `aria-hidden`
- **AND** expanding the product removes `inert` and exposes the content again

#### Scenario: An empty product report has no dangling panel relationship

- **WHEN** a product report has no renderable content
- **THEN** its disabled header omits `aria-controls`
- **AND** no product-content region is rendered for that header

#### Scenario: Settings and Admin disclosures identify their controlled regions

- **WHEN** an administrator inspects the AI Provider, Product stage-assignment,
  or Activity lead-attachment disclosure
- **THEN** the toggle's `aria-controls` resolves to the disclosed region
- **AND** the region's `aria-labelledby` resolves to that toggle
- **AND** a mounted collapsed Admin row region reports `aria-hidden="true"`

#### Scenario: An empty product header has no disclosure state

- **WHEN** a product report has no renderable content and no panel
- **THEN** its disabled header omits aria-expanded as well as aria-controls
- **AND** the existing empty-product content and disabled behavior remain unchanged
