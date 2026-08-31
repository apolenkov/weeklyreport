# @customreport/shared

Shared Zod schemas, TypeScript types, and tRPC role middleware/guard contracts
used by both `@customreport/api` and `@customreport/web`. The API owns the
router definitions; this package owns the shared role checks and data contracts.
Its source-of-truth consumers are the API, Web, report-persistence writers and
read models, and Prisma seed profiles.

## Schemas

| Schema                         | File                                        | Description                                                        |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| `reportSectionReadModelSchema` | `schemas/report-sections/section.schema.ts` | Full report section with records, risks, decisions, and priorities |
| `draftSaveSchema`              | `schemas/report-sections/section.schema.ts` | Draft-save input with canonical record validation                  |
| `submitSectionSchema`          | `schemas/report-sections/section.schema.ts` | Submit input with confirmation and product statuses                |
| `userSessionSchema`            | `schemas/auth/auth.ts`                      | Session identity, role, and active report context                  |
| `roleSchema`                   | `schemas/auth/auth.ts`                      | Role enum: lead, head, admin, viewer                               |

## Key Utilities

- `safeText()` — Zod string refinement that rejects null bytes and values made only of invisible characters
- `reportDate()` — Date schema accepting years 2000 and later
- Unique rank refinement on priority arrays
- Bounded save arrays (up to 100 items, risks, decisions, and status entries per
  section)

## Testing

```bash
pnpm --filter @customreport/shared test
```
