## ADDED Requirements

### Requirement: The slide deck MUST form the `features/slides` slice and `components/` MUST NOT survive

The status-slide presentation deck MUST live in a `features/slides` slice, NOT
under `apps/web/src/components/`. Pure grid/view-model files MUST sit in
`features/slides/model/` and the rendering components in `features/slides/ui/`. The
`slides` slice MUST be registered in the `webSlices` enforcement array with its
cross-slice edges grandfathered. After this relocation the
`apps/web/src/components/` directory MUST NOT exist — every web domain lives in a
`features/` slice or `shared/`.

#### Scenario: components/ no longer exists

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/components/` no longer exists
- **AND** the former slide files reside under `features/slides/{ui,model}/`

#### Scenario: consumers import the deck from the slides slice

- **WHEN** the head/lead/viewer report shells render the slide deck
- **THEN** they import it from `features/slides/ui/*`
- **AND** no code imports `components/slides/*`

#### Scenario: the slides slice boundary is enforced

- **WHEN** a file outside `features/slides` imports a slides internal, or slides
  imports another slice's internal, without a grandfathered `except` entry
- **THEN** `import-x/no-restricted-paths` reports a web-slice-boundary error
