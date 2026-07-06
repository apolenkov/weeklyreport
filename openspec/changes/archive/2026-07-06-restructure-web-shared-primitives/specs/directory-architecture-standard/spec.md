## ADDED Requirements

### Requirement: Business-agnostic web primitives MUST live in `shared/`, not the `components/` root

The flat `apps/web/src/components/` root MUST NOT hold business-agnostic UI
primitives. `error-boundary`, `forbidden-page`, `role-gate`, `agentation-devtools`,
the `coming-soon-style` source-scan test, and the former `components/ui/` bucket
(`confirmation-dialog`, `sdlc-tooltip`) MUST reside under `apps/web/src/shared/ui/`.
`web-vitals-reporter` MUST reside in its own `features/telemetry/ui/` slice. The
`components/ui/` and `components/__snapshots__/` directories MUST NOT survive. After
this change, `components/` retains only the deferred `slides/` tree and the `dev/`
tooling (its own later slice). The relocation MUST be behavior-neutral.

#### Scenario: Primitives graduate to shared

- **WHEN** the relocation is applied
- **THEN** `error-boundary`, `forbidden-page`, `role-gate`, `agentation-devtools`,
  `confirmation-dialog`, and `sdlc-tooltip` reside under `apps/web/src/shared/ui/`
- **AND** `web-vitals-reporter` resides under `apps/web/src/features/telemetry/ui/`
- **AND** `apps/web/src/components/ui/` no longer exists
- **AND** consumers import each from its new home, with no `components/` root primitive left

#### Scenario: A relocated source-scan test keeps scanning the whole tree

- **WHEN** `coming-soon-style.test.tsx` runs from its new `shared/ui/` home
- **THEN** its filesystem `repoRoot` and control-file path anchors account for the
  deeper location, so it still scans `apps/web/src` + `packages/ui/src`
