## REMOVED Requirements

### Requirement: Frontend Audit Memo MUST Exist Before UI Implementation

**Reason**: This was a planning-only deliverable for a closed research change, not a permanent UI capability. The archived `2026-05-30-ui-ux-vercel-audit-research` change preserves the memo and its deferred implementation decision.

**Migration**: Do not carry forward a memo gate. Any future implementation must use a separately approved change governed by the relevant UI, accessibility, layout, and `web-loading-performance` specifications.

A UI/UX, Next.js 16 / Vercel, and Core Web Vitals audit memo MUST be produced
as a research deliverable, and frontend visual/UX/Vercel/CWV implementation MUST
NOT proceed until explicit direction is given. The memo MUST record observations
and recommendations only; it MUST NOT mandate any visual, theme, background,
font, or slide-layout change.

#### Scenario: Audit memo is the deliverable

- **WHEN** the `ui-ux-vercel-audit-research` change is reviewed
- **THEN** an audit memo exists in the change's `design.md` covering UI/UX,
  accessibility, Next.js 16 / Vercel best practices, and Core Web Vitals
- **AND** the memo contains no code tasks and no spec deltas that mandate a UI
  change

#### Scenario: Implementation stays deferred

- **WHEN** the audit findings are considered for action
- **THEN** no visual, theme, background, font, slide-layout, Vercel, or Core Web
  Vitals change is implemented without explicit direction
- **AND** `tasks.md` records the explicit deferral note

### Requirement: Core Web Vitals Findings MUST Be Grounded, Not Fabricated

**Reason**: This requirement constrained one historical research memo; unmeasured Core Web Vitals are not a current product contract.

**Migration**: Retain the memo and measurement plan in the archive. Move only measured, implemented performance behaviour into the concrete `web-loading-performance` requirements for heavy chunks, fonts, and Suspense fallbacks.

The audit memo's Core Web Vitals section MUST be limited to static observations
grounded in existing instrumentation plus a measurement plan, and MUST NOT
report measured Lighthouse or Core Web Vitals scores that were not produced
under the planning-only scope.

#### Scenario: CWV section is honest about scope

- **WHEN** the Core Web Vitals section of the memo is read
- **THEN** it references the existing instrumentation
  (`apps/web/src/features/telemetry/model/vitals/web-vitals.ts`,
  `apps/web/src/features/telemetry/ui/web-vitals-reporter.tsx`,
  `apps/web/src/app/layout.tsx`)
- **AND** it presents a "what to measure later" plan rather than fabricated LCP,
  INP, or CLS scores
