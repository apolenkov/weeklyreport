## 1. Identity sub-tab: dirty-guarded reseed + safe revalidate

- [ ] 1.1 `settings-identity-sub-tab.tsx`: add dirty tracking for
      `shortName`/`fullName` (an `isDirty` flag or a last-seeded-values ref
      compared against current state)
- [ ] 1.2 Change the `orgQ.data` reseed effect to only run when the form is
      not dirty, so an in-progress edit is not overwritten by a background
      refetch
- [ ] 1.3 On a successful save, clear the dirty flag (or update the
      last-seeded ref) so the next legitimate `orgQ.data` change reseeds
      normally
- [ ] 1.4 Route the post-save `/api/revalidate-org` call through the
      safety-fixed `useUpdateSettingsMut`-style helper (or apply the same
      `.ok`/try-catch handling inline) instead of the current unchecked
      `fetch(...)`

## 2. Shared settings-mutation helper: safe revalidate

- [ ] 2.1 `settings-tab-shared.tsx`: wrap the `/api/revalidate-org` fetch in
      `try/catch` and check `response.ok`
- [ ] 2.2 On success, keep the existing `"${label} saved"` toast (the
      settings mutation itself succeeded)
- [ ] 2.3 On a non-ok response or a thrown fetch, still show the `saved`
      toast but additionally emit a distinct revalidation-failed
      toast/log, so a stale landing-page cache is visible instead of
      reported as a clean save — and so a thrown fetch never turns a
      successful save into a false error toast

## 3. Notifications sub-tab: dirty-guarded reseed

- [ ] 3.1 `settings-notifications-sub-tab.tsx`: add the same not-dirty guard
      to the `setDraft(serverSettings)` reseed effect used by the Identity
      sub-tab

## 4. Spec delta

- [ ] 4.1 `admin-settings-ui`: ADD a requirement that settings sub-tab forms
      preserve unsaved edits across a background query refetch and report
      landing-page revalidation failures distinctly from save failures

## 5. Verification

- [ ] 5.1 Manual check: open Settings → Identity, start typing in Short
      name, trigger a background refetch (e.g. focus another window tab and
      return past `staleTime`), confirm the in-progress text is not
      overwritten
- [ ] 5.2 Manual check: save Identity with `/api/revalidate-org` mocked to
      return a non-2xx response, confirm the UI still shows the settings-saved
      toast plus a distinct revalidation-failed toast, not a plain
      "Organization identity saved" with no signal of the stale cache
- [ ] 5.3 `pnpm --filter @customreport/api db:generate`
- [ ] 5.4 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.5 `npx openspec validate fix-org-settings-form-safety --strict`
