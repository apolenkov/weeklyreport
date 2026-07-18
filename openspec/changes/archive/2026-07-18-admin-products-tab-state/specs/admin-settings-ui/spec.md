## ADDED Requirements

### Requirement: The products-tab deep-link auto-expand does not re-fire on data-only refetches

The products-tab deep-link auto-expand effect MUST auto-expand the
`?product=<id>` panel on initial load, but MUST NOT re-open a panel the user
has manually collapsed solely because the underlying `products` data
reference changed. This governs `ProductsTab`
(`apps/web/src/features/admin/ui/products-tab.tsx`), whose effect currently
re-runs on any new `products` reference (e.g. from a same-tab product
mutation invalidating `admin.snapshot`). The effect MUST distinguish a
genuine new deep-link target (`productFilter` changing) from a data-only
refetch, and only the former re-triggers auto-expand once the user has
manually toggled the panel.

#### Scenario: A same-tab mutation does not reopen a collapsed deep-linked panel

- **GIVEN** an admin is on `/admin?tab=products&product=<id>` and has
  manually collapsed the auto-expanded panel
- **WHEN** the admin edits or archives a different product in the same tab,
  invalidating `admin.snapshot` and producing a new `products` reference
- **THEN** the deep-linked panel stays collapsed after the refetch

#### Scenario: A new deep-link target still auto-expands

- **GIVEN** an admin navigates to a new `?product=<id>` deep link for a
  different product
- **WHEN** the products tab renders with the new `productFilter`
- **THEN** the newly-targeted panel auto-expands, even if the user had
  previously collapsed a different panel
