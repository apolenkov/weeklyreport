## ADDED Requirements

### Requirement: Dead web-frontend surface found by the 2026-07-22 mass review MUST be deleted, not just tolerated

The backlog SHALL record that the 2026-07-22 mass review confirmed three
more pieces of `apps/web` surface with no production caller or effect, and
that these were deleted rather than kept: the `<Suspense
fallback={<NavBarSkeleton />}>` boundary in `app/(app)/layout.tsx` and
`NavBarSkeleton` itself (`shared/ui/navigation/nav-bar-skeleton.tsx`) — dead
because `NavBar` never suspends and already owns its own internal loading
skeleton; the `chrome?: "full" | "content"` prop on `LeadSlidesClient`
(`features/slides/ui/lead-slides-client.tsx`) — declared and passed by its
one caller but never read; and the `stagesWithoutRiskCoverage` field
computed by `computeCoupling` (`hooks/use-status-risk.ts`) — carried its own
dedicated test block but has no production reader.

#### Scenario: Reviewer re-encounters one of the removed symbols

- WHEN a future review or grep turns up `NavBarSkeleton`, a Suspense
  boundary wrapping `NavBar`, a `chrome` prop on `LeadSlidesClient`, or
  `stagesWithoutRiskCoverage` reintroduced in `apps/web`
- THEN treat it as new dead surface requiring the same justification (a real
  production caller/reader) before it is allowed to stay, not as a
  restoration of prior-approved code

#### Scenario: A component prop is added to a public interface

- WHEN a component's exported props interface declares an optional prop
  (e.g. `chrome?: "full" | "content"`)
- THEN the component's implementation MUST read and branch on that prop, or
  the prop MUST be removed — a props interface may not advertise behavior
  the implementation does not provide

#### Scenario: A Suspense boundary is added around a component

- WHEN a component is wrapped in `<Suspense fallback={...}>`
- THEN the wrapped component MUST actually suspend (throw a promise, e.g.
  via a suspense-enabled query) under some reachable condition, or the
  boundary and its fallback component MUST be removed — a Suspense
  fallback that can never render is dead surface, not a safety net
