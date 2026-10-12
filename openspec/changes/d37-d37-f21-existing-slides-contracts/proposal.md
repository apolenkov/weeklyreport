# Proposal

## Why

Slide authors can show broken initials, an empty activity can keep a blank card expanded, and an own deck can stop loading before cross-author health arrives. An active Head activity fallback failure also misses the required query error policy. D37-F21 BRIEF original C3114, C3128, C3160 and C5155 identify these existing-contract gaps.

## What Changes

- Use the existing canonical web initials owner in both slide rosters.
- Collapse a card with neither records nor product/activity status.
- Keep an own deck loading while its enabled health read is pending.
- Report active Head activity fallback failures through the existing log-only query policy.
- Remove the dead foreign item alarm flag and first-child variants; derive status presentation from the shared mapping and article keys from one local formula.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Existing requirements in `structured-user-name`, `user-name-display`, `lead-slide-by-product-grid`, `status-slide-rendering` and `client-error-policy` already govern these repairs. `skip_specs: true` avoids inventing delta requirements.

## Impact

Only the granted web slide owners and colocated tests. No dependency, transport, schema or persistence change. Published shared layout/author-marker ownership is reused.

## Non-goals

- No foreign-health readiness policy change: `status-risk-unification` keeps own project counts before foreign adjustment.
- No new first-divider, palette, ordering, error-state or debounce policy.
- No performance claim, native browser/AT/CLS acceptance, log-forwarder delivery or whole-repository acceptance.
