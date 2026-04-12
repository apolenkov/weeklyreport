# @customreport/shared

Shared Zod schemas, TypeScript types, and tRPC router definition used by both `@customreport/api` and `@customreport/web`.

## Schemas

| Schema | File | Description |
|--------|------|-------------|
| `reportSectionSchema` | `schemas/report.ts` | Full report section with projects, items, risks, decisions, priorities |
| `draftSavePayloadSchema` | `schemas/report.ts` | Draft save input with `safeText()` sanitization |
| `submitSectionPayloadSchema` | `schemas/report.ts` | Submit input with `confirmed: true` and project statuses |
| `userSessionSchema` | `schemas/auth.ts` | JWT payload: userId, email, name, role, active report/section |
| `roleSchema` | `schemas/auth.ts` | Role enum: lead, head, viewer |

## Key Utilities

- `safeText()` — Zod string refinement that rejects null bytes and zero-width spaces
- `reportDate()` — Date schema rejecting pre-2000 dates
- Unique rank refinement on priority arrays
- Array max limits (100 items, 50 projects)

## Testing

```bash
pnpm exec vitest run src/schemas/__tests__/    # 115 boundary tests
```
