# Proposal

## Why

In slide presentation mode (`?mode=slides`), the author initials badge rendered in the slide legend (`SlideLegend`) is not hidden from assistive technology (`aria-hidden="true"`) and lacks an accessible full-name element (`<span className="sr-only">`), causing screen readers to read initials redundantly alongside or instead of the full name. In contrast, `PriorityAuthorBadge` in `slide-article-header.tsx` already hides visible initials with `aria-hidden="true"` and provides `<span className="sr-only">{author.name}</span>`. This addresses residual finding C5166 from TASK-503.95.

## What Changes

- Align `SlideLegend` initials badge markup with `PriorityAuthorBadge`: wrap initials in `<span aria-hidden="true">{author.initials}</span>` and provide `<span className="sr-only">{author.name}</span>` within the badge element.
- Add unit test coverage in `slide-article-header.test.tsx` verifying that `SlideLegend` author initials badge markup hides initials from AT and exposes the accessible full name.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is an accessibility bugfix ensuring accessible author names in slide legends; skip_specs is true.

## Impact

Scoped to `apps/web/src/features/slides/ui/slide-article-header.tsx` and its test. No API, persistence or data model changes.

## Non-goals

- Redesigning slide layout or extracting external shared author badge components across features.
