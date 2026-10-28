# Design

## Context

In `apps/web/src/features/slides/ui/slide-article-header.tsx`, `PriorityAuthorBadge` (lines 107–116) renders:

```tsx
<span
  data-testid="slide-priority-author-badge"
  title={author.name}
  className={SLIDE_AUTHOR_BADGE_CLASS}
  style={{ background: authorSlotBackground(author) }}
>
  <span aria-hidden="true">{author.initials}</span>
  <span className="sr-only">{author.name}</span>
</span>
```

However, in `SlideLegend` (lines 208–213), the initials badge was:

```tsx
<span
  className={SLIDE_AUTHOR_BADGE_CLASS}
  style={{ background: authorSlotBackground(author) }}
>
  {author.initials}
</span>
```

This raw initials text is read by screen readers without aria-hidden, while `PriorityAuthorBadge` hides initials and exposes `sr-only` author name.

## Goals / Non-Goals

### Goals

- Make the initials badge in `SlideLegend` match the accessible pattern in `PriorityAuthorBadge`:
  - `span` with `aria-hidden="true"` for initials
  - `span` with `className="sr-only"` for author's full name (`author.name`)
- Retain exact styling, class names, and short name text rendering for the legend entry.
- Verify via Vitest / React Testing Library jsdom test.

### Non-Goals

- Altering the author color mapping or font size.
- Refactoring `PriorityAuthorBadge` or `SlideLegend` into a shared component across packages.

## Decisions

Update `SlideLegend` directly to mirror `PriorityAuthorBadge`'s markup structure for the badge span. Add unit tests for `SlideLegend` in `slide-article-header.test.tsx`.

## Risks / Trade-offs

Low risk: purely additive accessible DOM attributes (`aria-hidden` and `sr-only`). Visual appearance is identical.
