## ADDED Requirements

### Requirement: Product-group ownership loads in one batched query

The admin "products attached" editor MUST resolve the owning reporting group
(if any) for a set of products with a single batched query keyed on all
product IDs, not one `admin.listProductGroups` call per product. The number
of network requests issued when the editor opens MUST NOT scale with the
number of active products in the catalog.

#### Scenario: Opening the products-attached dialog issues one ownership query

- **GIVEN** a reporting group's edit dialog listing N active products
- **WHEN** the "Products attached" editor loads
- **THEN** exactly one `admin.listProductGroupOwnership` request is issued
  for all N product IDs, instead of N separate `admin.listProductGroups`
  requests

#### Scenario: Ownership updates after attach or detach

- **GIVEN** the batched ownership query has already loaded
- **WHEN** a product is attached to or detached from a group
- **THEN** the batched ownership cache is invalidated and refetched so the
  lock state ("Already attached to X") reflects the new edge, without
  reverting to per-product queries
