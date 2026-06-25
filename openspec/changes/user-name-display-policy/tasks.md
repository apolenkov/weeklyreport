# Tasks — user-name display-format policy

## 1. Shared helper

- [x] 1.1 Add `shortNameFromName(name: string)` to `packages/shared`
      (`name/user-name.ts`): surname + dotted initials of remaining tokens;
      single token → surname; empty → "". Export from the package index.
- [x] 1.2 Unit-test it: full ФИО → «Иванов В.П.», no patronymic → «Каштанова М.»,
      single token, noisy whitespace, empty.

## 2. Stage owner labels (the reported bug)

- [x] 2.1 `lib/mappers/lead-form.ts` (buildStageGrid): own-stage `assignee` uses
      `shortNameFromName(ownerLabel)` instead of the full `authorName`.
- [x] 2.2 Backend: `getCrossAuthors` returns `authorShortName =
    shortNameFromName(row.user.name)`; thread the field through the repository
      return type, `lead-form-shared.ts`, `lead-form.service.ts`, and the tRPC
      output. Update the "full name never leaves" comment to reflect ADR 0006.
- [x] 2.3 Web `CrossAuthorRow` gains `authorShortName`;
      `buildCrossAuthorStageMap` sets the foreign-stage `assignee` to
      `authorShortName` (was the two-letter `authorInitials`).

## 3. Other spelled-out name labels → short form

- [x] 3.1 Slides: `components/slides/section-slide-utils.ts` — `ownerName` (both
      builders) and the contributors list use `shortNameFromName` (dedup still
      keys on the full name).
- [x] 3.2 Cross-author content authors: `lib/mappers/lead-cross-author.ts`
      `author` / `authorName` use `shortNameFromName(ca.authorName)`.
- [x] 3.3 Leads summary table: the row name (`lead-summary-table.tsx`, currently
      full ФИО) uses the short form via its mapper.
- [x] 3.4 Dashboard escalations: `lib/mappers/dashboard.ts` `assignee`
      (`escalation.leadName`) uses `shortNameFromName`.

## 4. Left unchanged (verify, do NOT touch)

- [x] 4.1 Round avatar marks (nav avatar, dashboard gutters, activity panel) and
      the item-row stage micro-chip «Development · ВИ» stay two-letter.
- [x] 4.2 The user's own top nav badge keeps the full ФИО. Admin Users table
      keeps `shortName(parts)` (already short).

## 5. Tests + gates

- [x] 5.1 Update characterization tests that pinned a full-ФИО display string to
      the short form (lead-form mappers, sdlc-pipeline, slides, dashboard,
      cross-author).
- [x] 5.2 Add/adjust a test proving the cross-author stage label renders
      `authorShortName`, and one proving avatars/micro-chips stay two-letter.
- [x] 5.3 `npx prisma generate` then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm build` all green; affected integration suites serial.
