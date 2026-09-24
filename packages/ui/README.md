# @customreport/ui

Shared React primitives for CustomReport. The package uses Tailwind CSS v4,
Radix primitives, class-variance-authority, Lucide icons, and CSS custom
properties; it is not a separate OKLCH theme package.

## Source of truth

- `src/styles/globals.css` imports `src/styles/theme.css` and
  `src/styles/utilities.css`.
- `theme.css` owns the `@theme` palette, font stacks, radii, layers, control
  dimensions, card-surface recipes, and slide constants.
- `utilities.css` owns shared `.card-surface`, skeleton, scale, press,
  reduced-motion, and print rules.
- The web app imports this package stylesheet from
  `apps/web/src/styles/app.css`, then adds its paper shell and landing hero
  layers in `apps/web/src/styles/app.css` and `apps/web/src/styles/pulse.css`.

See the repository-level [DESIGN.md](../../DESIGN.md) for the exact current
palette, typography, layout grammar, component states, motion, depth strategy,
and WCAG constraints.

## Components

The source tree currently contains **13 component `.tsx` files**:

- **13 files under `src/components/ui/`**. Current consumers import twelve live
  UI modules by subpath: Alert, Button, Card, Chart, Dialog, DropdownMenu,
  Separator, Sheet, Skeleton, Toaster, Tabs, and Tooltip.
- `dropdown-menu-items.tsx` and `dialog-focus.ts` (imported by `dialog.tsx`)
  are the internal source modules, absent from the exports map. The package
  utility is imported from `@customreport/ui/lib/utils`. Only currently
  consumed subparts are public: card content/header;
  dialog content/description/title; dropdown
  content/item/label/separator/trigger; sheet
  content/description/header/title/trigger; and tabs content/list/trigger.

## Design tokens

Tokens are named CSS variables such as `--color-background`, `--color-card`,
`--color-primary`, `--color-success`, `--color-destructive`, `--color-border`,
`--color-ring`, and `--radius-pill`. Current values are hex or `rgba()` in
`theme.css`; do not introduce unprefixed aliases or an undefined generic
`--color-surface`. Use `--color-surface-muted`, `--color-surface-hover`, or
`--color-surface-empty` according to semantic role. The product currently ships
one light palette; use `--color-on-dark` only for text on deep brand surfaces.

## Usage

```tsx
import { Button } from "@customreport/ui/components/ui/button";
import { Card, CardContent } from "@customreport/ui/components/ui/card";
import "@customreport/ui/styles/globals.css";
```
