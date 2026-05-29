## ADDED Requirements

### Requirement: Frontend Audit Memo MUST Exist Before UI Implementation

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

The audit memo's Core Web Vitals section MUST be limited to static observations
grounded in existing instrumentation plus a measurement plan, and MUST NOT
report measured Lighthouse or Core Web Vitals scores that were not produced
under the planning-only scope.

#### Scenario: CWV section is honest about scope

- **WHEN** the Core Web Vitals section of the memo is read
- **THEN** it references the existing instrumentation
  (`apps/web/src/lib/web-vitals.ts`,
  `apps/web/src/components/web-vitals-reporter.tsx`,
  `apps/web/src/app/layout.tsx`)
- **AND** it presents a "what to measure later" plan rather than fabricated LCP,
  INP, or CLS scores
