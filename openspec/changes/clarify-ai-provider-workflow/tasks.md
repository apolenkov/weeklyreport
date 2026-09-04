## 1. UI state model

- [x] 1.1 Map existing `AiProviderControlRead` and revision/execution/progress
      fields to summary states without adding a new API status.
- [x] 1.2 Implement explicit active read mode and `Edit configuration` entry;
      keep unconfigured, draft, and failed revisions in edit mode by default.
- [x] 1.3 Keep the Configure, Test, and Activate steps visible with inline
      disabled reasons and accessible loading, progress, and error regions.

## 2. Card layout and responsive behavior

- [x] 2.1 Reshape `AiProviderCardContent` into summary, peer Generation and
      Embeddings cards, lifecycle actions, and secondary diagnostics/history.
- [x] 2.2 Preserve conditional separate-embedding fields, credential-retention
      semantics, endpoint rules, current Demo tokens, and no horizontal overflow
      at the supported narrow viewport.
- [x] 2.3 Keep Diagnostics closed by default with correct native disclosure
      labelling and retain Restore/Discard semantics for eligible revisions.

## 3. Verification

- [x] 3.1 Add/update component tests for unconfigured, draft, queued/running,
      validated, preparing, active, failed, and retained-revision states,
      including disabled-action reasons.
- [x] 3.2 Browser-verify `/admin?tab=ai` in the current server state at desktop
      and narrow widths for keyboard focus, no horizontal overflow, and zero
      console/network errors; cover the other lifecycle states in component
      tests without mutating the shared provider configuration.
- [x] 3.3 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `pnpm spec:check`, and
      `openspec validate clarify-ai-provider-workflow --strict`.
