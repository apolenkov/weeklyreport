## 1. Schema bound

- [ ] 1.1 `packages/shared/src/schemas/section.schema.ts`: add
      `.max(MAX_RECORDS_PER_SECTION_SAVE)` to `draftSaveSchema.projectStatuses`
- [ ] 1.2 `packages/shared/src/schemas/section.schema.ts`: add
      `.max(MAX_RECORDS_PER_SECTION_SAVE)` to `draftSaveSchema.stageStatuses`
- [ ] 1.3 `packages/shared/src/schemas/section.schema.ts`: add
      `.max(MAX_RECORDS_PER_SECTION_SAVE)` to `submitSectionSchema`'s
      `projectStatuses` override

## 2. Spec delta

- [ ] 2.1 `section-save-payload-bounds`: ADD a requirement that every
      section-save array carries the shared payload-size bound

## 3. Gates and verification

- [ ] 3.1 `pnpm --filter @customreport/shared test`
- [ ] 3.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.3 `openspec validate bound-section-save-arrays --strict`
