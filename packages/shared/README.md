# @customreport/shared

Shared Zod schemas, TypeScript types, and tRPC router definition used by both `@customreport/api` and `@customreport/web`.

## Schemas

| Schema                       | File                              | Description                                                        |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `reportSectionSchema`        | `schemas/report/report.schema.ts` | Full report section with records, risks, decisions, and priorities |
| `draftSavePayloadSchema`     | `schemas/report/report.schema.ts` | Draft save input with `safeText()` sanitization                    |
| `submitSectionPayloadSchema` | `schemas/report/report.schema.ts` | Submit input with `confirmed: true` and product statuses           |
| `userSessionSchema`          | `schemas/auth/auth.ts`            | Session payload with identity, role, and active report context     |
| `roleSchema`                 | `schemas/auth/auth.ts`            | Role enum: lead, head, admin, viewer                               |

## Key Utilities

- `safeText()` — Zod string refinement that rejects null bytes and zero-width spaces
- `reportDate()` — Date schema rejecting pre-2000 dates
- Unique rank refinement on priority arrays
- Array max limits (100 items, 50 projects)

## Testing

```bash
pnpm exec vitest run src/schemas/              # shared schema tests
```
