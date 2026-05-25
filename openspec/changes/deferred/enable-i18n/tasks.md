# Tasks

## i18n library setup + string extraction

- **i18n-T1** Choose i18n library (next-intl recommended for Next.js 16);
  add to `package.json`
- **i18n-T2** Create `.intl/messages/en.json` and `.intl/messages/ru.json`
  with UI string keys
- **i18n-T3** Extract all hardcoded UI strings from components; replace with
  i18n keys (e.g., `t('nav.logout')`)
- **i18n-T4** Wrap app root with i18n provider; add locale switcher to nav
  bar
- **i18n-T5** Persist user locale preference to localStorage; restore on page
  load
- **i18n-T6** Update `.env` with default locale (`NEXT_PUBLIC_LOCALE=en`)
- **i18n-T7** Test: switch locale, verify UI text changes, refresh page and
  verify locale persists
- **i18n-T8** Commit: `feat(i18n): enable RU/EN locale switcher (Phase 58)`

## Verification

```bash
pnpm --filter @customreport/web test -- \
  src/components/navigation/__tests__/locale-switcher.test.tsx
pnpm --filter @customreport/web typecheck
```
