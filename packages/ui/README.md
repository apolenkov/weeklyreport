# @customreport/ui

Shared React primitives for CustomReport. The package uses Tailwind CSS v4,
Radix primitives, class-variance-authority, Lucide icons, and CSS custom
properties; it is not a separate OKLCH theme package.

## Source of truth

- `src/styles/globals.css` imports `src/styles/theme.css` and
  `src/styles/utilities.css`.
- `theme.css` owns the `@theme` palette, font stacks, radii, layers, control
  dimensions, card-surface recipes, and slide constants.
- `utilities.css` owns shared `.card-surface`, toolbar fill, skeleton, fade,
  scale, collapsible, press, reduced-motion, and print rules.
- The web app imports this package stylesheet from
  `apps/web/src/styles/app.css`, then adds its paper shell and landing hero
  layers in `apps/web/src/styles/app.css` and `apps/web/src/styles/pulse.css`.

See the repository-level [DESIGN.md](../../DESIGN.md) for the exact current
palette, typography, layout grammar, component states, motion, depth strategy,
and WCAG constraints.

## Components

The source tree currently contains **25 component `.tsx` files**:

- **22 files under `src/components/ui/`**. Twenty UI modules are exported from
  the package root: Alert, Avatar, Badge, Button, Card, Collapsible, Dialog,
  DropdownMenu, Input, Label, Progress, Select, Separator, Sheet, Skeleton,
  Toaster, Table, Tabs, Textarea, and Tooltip.
- `chart.tsx` and `dropdown-menu-items.tsx` are source modules used by the
  package but are not separate root exports.
- **3 custom composition files** are at `src/components/`: `ComingSoonBadge`,
  `ComingSoonTooltip`, and `ComingSoonControl`. The first two are root exports;
  `ComingSoonControl` is intentionally consumed through its component path.

The public root also exports `useIsMobile` and `cn`. Individual modules expose
their Radix subparts (for example `CardHeader`, `DialogContent`, `TabsTrigger`)
through the same public surface.

## Design tokens

Tokens are named CSS variables such as `--color-background`, `--color-card`,
`--color-primary`, `--color-success`, `--color-destructive`, `--color-border`,
`--color-ring`, and `--radius-pill`. Current values are hex or `rgba()` in
`theme.css`; do not introduce legacy unprefixed aliases or an undefined generic
`--color-surface`. Use `--color-surface-muted`, `--color-surface-hover`, or
`--color-surface-empty` according to semantic role. The current `.dark` class
overrides only the coming-soon pair and overlay; it is not a full alternate
palette.

## Usage

```tsx
import { Badge, Button, Card, CardContent } from "@customreport/ui";
import "@customreport/ui/styles/globals.css";
```
