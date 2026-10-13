# Design

## Context

See proposal.md. Alert reserves a zero-width icon column without an icon. Its title and description occupy the content column, while a direct button auto-places in the icon column. Three recovery callers have this composition. Native SessionProvider evidence distinguishes compressed geometry from invisibility: the action is still clickable.

## Decisions

Nest each existing action in AlertDescription. This existing component owns the content column and start-aligned child sizing; no new slot, duplicated positioning class, or shared Alert change is needed. Keep each callback, pending/disabled state, text, and `mt-3` intact. Class-based placement is also local but repeats layout ownership; a shared wildcard fallback broadens the affected SVG and non-action consumers.

## Risks / Trade-offs

- Description's gap and the existing margin combine: inspect complete wide and narrow frames.
- Nesting must preserve the native button and visible focus ring: verify keyboard recovery and current focused behavior checks.
- Native evidence reaches SessionProvider through the public Head route; route/global rendering exceptions are source and focused-test coverage, not a new browser acceptance claim.

## Migration Plan

No migration or configuration rollout. Revert the three composition changes if needed. Period lifecycle, canonical authorization middleware, destructive guards, and development-only last-role policy remain intact. Verification uses the already provisioned private D target under a separate bounded lease.
