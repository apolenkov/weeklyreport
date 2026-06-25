## Decisions

The durable policy (which surface uses which form, and the narrow cross-author
privacy reversal) lives in **ADR 0006** and the `User name (ФИО)` glossary entry;
this change implements it. Change-scoped notes only here.

- **Where to apply the short form — at the data-model/mapper layer, once.** Each
  display name field is shortened where its presentation model is built, NOT at
  the render leaf. Render components print the value as-is. This avoids double
  application (`shortNameFromName("Иванов В.П.")` would wrongly drop the
  patronymic initial → «Иванов В.»).
- **`shortNameFromName(name)` vs `shortName(parts)`.** Most display sites carry
  only the denormalized `name` string, not the structured parts, so the new
  string helper is the one they use. Sites that already have parts (admin Users
  table) keep `shortName(parts)`.
- **Cross-author short name comes from the backend.** The lead-form cross-author
  STATUS read (`getCrossAuthors`) only had the two-letter mark client-side. Add
  `authorShortName: shortNameFromName(row.user.name)` server-side and thread the
  field through the repository → service → tRPC → web `CrossAuthorRow` type so the
  foreign stage label can render it. The full name still never leaves the server.
- **Item-row stage micro-chip stays two-letter.** «Development · ВИ» is an inline
  identity mark in a very tight row; the short form would break the layout. Only
  the SDLC pipeline stage OWNER label (a separate element) goes short.

## Surfaces touched

- `shortNameFromName` — `packages/shared` (helper + test).
- Own stage owner label — `lib/mappers/lead-form.ts` (buildStageGrid).
- Cross-author stage owner label — backend `authorShortName` + web
  `lib/mappers/lead-cross-author.ts` (`buildCrossAuthorStageMap`).
- Slides — `components/slides/section-slide-utils.ts` (ownerName + contributors).
- Cross-author content authors — `lib/mappers/lead-cross-author.ts`.
- Leads summary table — `components/dashboard/lead-summary-table.tsx` mapper.
- Dashboard escalations — `lib/mappers/dashboard.ts`.
- Unchanged (two-letter): round avatars, item-row stage micro-chip.
