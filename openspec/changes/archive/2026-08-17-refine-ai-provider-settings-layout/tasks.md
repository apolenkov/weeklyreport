## 1. Settings tab strip

- [x] 1.1 Update `SettingsTab` so the outer `TabsList` keeps horizontal overflow available while explicitly preventing vertical scrolling; preserve tab values, order, and keyboard navigation.
- [x] 1.2 Add focused coverage that the outer Settings tab strip uses the horizontal-only overflow contract without touching AI sub-tabs or other Settings content.

## 2. AI Provider layout

- [x] 2.1 Reduce the nested Provider surface chrome and tighten `AiProviderCardContent` header, summary, disclosure, and section spacing while preserving status, `aria-expanded`, and existing test identifiers.
- [x] 2.2 Recompose the Generation and Embeddings sections as responsive peer regions, replacing touched utility spacing with the repository's `gap-*` composition and preserving every field, conditional separate-connection block, and draft payload mapping.
- [x] 2.3 Compact the Provider action bar, capability feedback, revision details, and retained revisions with clear separators and hierarchy without removing lifecycle actions or diagnostics.
- [x] 2.4 Update focused Provider UI tests for the compact structure, responsive section presence, preserved conditional fields, actions, and feedback states.
- [x] 2.5 Flatten the Provider surface and make its header a compact summary row with active model, status, and an explicit disclosure indicator.
- [x] 2.6 Use a 7/12 Generation and 5/12 Embeddings desktop composition while preserving the stacked narrow layout and all field mappings.
- [x] 2.7 Keep capability feedback in a compact status strip and move revision metadata and retained revisions into a closed-by-default `Diagnostics` disclosure.
- [x] 2.8 Extend focused Provider tests for the flat surface, 7/12 + 5/12 columns, header disclosure indicator, and Diagnostics open/closed states.

## 3. Verification

- [x] 3.1 Run the focused web tests: `cd apps/web && pnpm exec vitest run src/features/organization/ui/ai-provider-card.test.tsx src/features/organization/ui/settings-ai-sub-tab.test.tsx src/features/admin/ui/settings-tab.test.tsx`.
- [x] 3.2 Run `pnpm typecheck` and `pnpm lint` from the repository root.
- [x] 3.3 Run `pnpm lint:md` and verify the 1440×746 and narrow-viewport layouts, including keyboard access to the horizontal Settings tab strip.
