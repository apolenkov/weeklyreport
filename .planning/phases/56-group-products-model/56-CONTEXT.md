# Phase 56: Group ↔ Products model expansion (STUB)

**Status:** idea — not yet scoped
**Driver:** «группы = люди и продукты привязаны к ним» (2026-05-10 in-chat capture)

## Current model

```
ReportingGroup → Users[]      (people in the group)
Project → User (leadId)       (products owned by a lead)
```

→ products are implicitly attached to a group through the lead's
`reportingGroupId`. There is no direct `Group → Products` edge.

## Proposed change

```
ReportingGroup ─┬→ Users[]              (people)
                └→ GroupProduct[]       (M:M to Products)
```

A product can belong to multiple groups (cross-departmental); a group
can own multiple products independent of any single lead. Lead-owned
products remain primary but the **group-membership** of a product
becomes explicit and editable by admin.

## Why this matters

- **Reporting clarity** — head sees «products my department owns»,
  not «products my leads happen to own». Better when leads rotate.
- **Cross-department products** — some projects span departments (e.g.
  «Платформа интеграций» involves both Software Development and Platform
  groups). Today this is unrepresentable.
- **RAG scoping** (Phase 54) — query «расскажи о продуктах группы X»
  needs explicit Group→Product edge.

## Likely shape

| Plan | Scope                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 56-A | Schema: `GroupProduct { id, groupId, productId, createdAt }` M:M join + backfill (insert one row per existing Product.leadId.reportingGroupId)    |
| 56-B | tRPC mutations: `admin.attachProductToGroup`, `admin.detachProductFromGroup`, `admin.listGroupProducts`                                           |
| 56-C | Admin → Groups tab: «Products attached» section per group with add/remove                                                                         |
| 56-D | Admin → Products tab: «Groups» column showing which groups the product belongs to                                                                 |
| 56-E | Group-scope filter (UFB-040 / Phase 46) extended: head's view of products derived from `GroupProduct` rather than `Project.lead.reportingGroupId` |

## Dependencies

- Phase 46 (group scope visibility) — extends the scope-filter logic
- Phase 48-A (Department vocabulary) — UI labels read «Department's products»

## Open questions for /gsd-discuss-phase

- Migration semantics: how do existing Project.leadId map? One row per
  (product, lead.group) or do we preserve dual-ownership somehow?
- Authority: can a non-leader of a product see / edit its data if their
  group has it attached?
- Deletion: archiving a Group with attached Products — block, cascade,
  or detach?
- UI ordering: which list is canonical — by group or by product?
