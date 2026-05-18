---
name: Small-MVP seed + Boris overlay + lead authorId fix (2026-05-18)
description: Vasily gets 4 products in seed; Boris co-author overlay on PROD_CRM_SALES; lead role can view foreign-author section only via hasSharedProduct gate
type: project
originSessionId: bb840bdb-6055-4c22-89f1-22c1182fbc37
---

4 продукта у Василия (`PROD_CRM`, `PROD_CRM_SALES`, `PROD_CRM_DATA`, `PROD_CRM_360`) в `prisma/seed-simple.ts`.
Борис (`a0000000-0000-4000-8000-00000000002b`) имеет отдельную `ReportSection` в `REPORT_ACTIVE` с 1 Item + 1 Risk на `PROD_CRM_SALES`.
`?authorId=<BORIS>` открывает секцию как read-only для Василия.

**Why:** демо ролевого разделения — product-switcher, cycle draft→submitted, чужая секция read-only.

**How to apply:** при UAT или демо: зайти как `vasily@customreport.local`, открыть `/lead/report?authorId=a0000000-0000-4000-8000-00000000002b` — увидеть read-only секцию Бориса.

Ключевые коммиты (ветка `feat/head-report-history-slides`):

- `345f4f1` — seed: 4 продукта + Boris overlay
- `49631ef` — `lead-form.service.ts`: `canViewOtherAuthor` теперь `head || admin || (lead && hasSharedProduct)`

TODO(LOCK-01) — UI-иконка-замочек на чужой секции — намеренно отложено, файл: `.planning/todos/pending/2026-05-18-lock-icon-foreign-section.md`.
