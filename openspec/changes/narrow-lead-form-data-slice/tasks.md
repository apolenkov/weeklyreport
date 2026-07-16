# Tasks

## 1. Inventory

- [ ] 1.1 Enumerate every `props.data.*` read in `LeadFormLoaded` and its children; the union of those fields IS the `LeadFormLoadedData` interface — no speculative extras

## 2. Narrow

- [ ] 2.1 Declare `LeadFormLoadedData` next to `LeadFormLoaded`; populate it at the `lead-form.tsx` seam; update child prop types
- [ ] 2.2 Update tests to construct the slice literally instead of mocking the hook shape; behavioral assertions carry over unweakened
- [ ] 2.3 Verify by grep that no `ReturnType<typeof use` remains in any props interface under `features/report-sections/ui/`

## 3. Gates

- [ ] 3.1 `pnpm typecheck`
- [ ] 3.2 `pnpm lint`
- [ ] 3.3 `pnpm test`
