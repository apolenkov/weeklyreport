# Design

## Public interface

One package entry point selects an explicit profile:

```text
pnpm db:seed:profile minimal
pnpm db:seed:profile demo
pnpm db:seed:profile full
pnpm db:seed:profile stress
```

Reset, visual-regression, UAT, migration, and development callers invoke the
same selector or its underlying typed function with an explicit profile.
Legacy `small`, `middle`, `huge`, `fresh:simple`, and `fresh:advanced` commands
may be removed in this breaking MVP cutover.

## Capability ladder

| Profile | Purpose                              | Required shape                                                                                                             |
| ------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| minimal | fastest boot/auth/write smoke        | canonical identities, active report, smallest valid editable graph                                                         |
| demo    | curated product walkthrough          | minimal plus roles, three health states, ownership, foreign content, reminders, submitted/draft contrast, published period |
| full    | all shipped capability families      | demo plus deep history, admin examples, activities, reopen, policies, archive/publish flows                                |
| stress  | scale and pagination/scroll behavior | every full capability plus deterministic high-volume products, sections, records, and history                              |

The checked-in manifest owns exact capability names, stable IDs, and bounded row
counts. Writers may remain separate, but they consume shared identities and
validation contracts rather than silently diverging.

## Flow

```text
profile selector
      |
      v
destructive guard -> reset/wipe -> profile writer
                                   |
                                   v
                       manifest invariant validator
                                   |
                                   v
                         profile smoke journey
```

Post-seed validation is scoped to the rows and report IDs created by that
profile. Leftover rows cannot satisfy a profile requirement.

## Migration and safety

This MVP permits direct schema reshaping and reset of disposable `_dev`,
`_test`, and `_uat` databases. The existing destructive guard remains the
authority; no spec statement authorizes production reset. Callers that formerly
depended on `seed-simple.ts` byte stability are migrated to manifest and journey
stability. Active-period dates may remain week-relative; stable identifiers and
text remain deterministic.

## Load-bearing invariants

- Destructive DB guard: preserved.
- Period dual-state: every profile creating reports writes both representations
  consistently.
- Role-coverage gate: unchanged; smoke journeys use public routes/procedures.
- Shared contracts and Prisma schema: may change only through explicit linked
  deltas, with all four profile manifests updated.
