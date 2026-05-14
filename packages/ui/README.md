# @customreport/ui

shadcn/ui v4 component library with Tailwind CSS v4 design tokens.

## Components

20 UI components including both shadcn/ui primitives and custom compositions:

### shadcn/ui Primitives

Alert, Badge, Button, Card, ConfirmDialog, Input, Label, Select, Separator, Skeleton, Tabs, Table, Toast/Toaster, Tooltip

### Custom Compositions

- `DataTable` — Sortable table with keyboard navigation (aria-sort, tabIndex, onKeyDown)
- `CrudSheet` — Slide-out panel for create/edit forms
- `TrafficLightBadge` — Green/yellow/red status indicator

## Design Tokens

OKLCH color system defined in `styles/globals.css`:

- Base palette: `--background`, `--foreground`, `--muted`, `--accent`, `--border`
- Semantic: `--success`, `--warning`, `--destructive`
- Component: `--skeleton` (visible on both light/dark themes)
- Print: hex fallbacks with `print-color-adjust: exact`

## Usage

```tsx
import { Button, Card, CardContent, Badge } from "@customreport/ui";
import "@customreport/ui/styles/globals.css";
```
