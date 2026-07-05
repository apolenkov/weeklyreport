# Mapping — web-comp-navigation (2026-07-02)

Source catalog: `docs/architecture/catalog/web-comp-navigation-2026-07-02.md` (2 files).
Rule reference: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` — Grouping rules.

| Current path                                            | Target path                                            | Layer       | Domain    | Move? | Note                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------ | ----------- | --------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/src/components/navigation/nav-bar-skeleton.tsx | apps/web/src/shared/ui/navigation/nav-bar-skeleton.tsx | ui (shared) | shared-ui | yes   | Business-agnostic, app-wide chrome (mounted in `app/(app)/layout.tsx`, not scoped to one domain slice) — Grouping rules Axis 2 "web" + determinism knob 1 (reused far beyond the rule-of-2 (web) threshold, it's global chrome) → `shared/ui/`. Catalog already tags it `shared-ui`, not a per-slice domain.                                |
| apps/web/src/components/navigation/nav-bar.tsx          | apps/web/src/shared/ui/navigation/nav-bar.tsx          | ui (shared) | shared-ui | yes   | Same rationale: role-scoped app nav bar spans every domain slice (lead/head/admin), depends only on cross-cutting web helpers (`lib/role-home`, `lib/session-provider`, dev/role-switcher) and `@customreport/shared`/`@customreport/ui` — no single owning slice, so it belongs in `apps/web/src/shared/ui/`, not `features/<domain>/ui/`. |

## Summary

- Files in scope: 2
- Rows where Current != Target (moves): 2
- Both files move from the flat `components/navigation/` folder into `shared/ui/navigation/` under the target FSD-lite tree — no domain slice owns app-wide nav chrome.
