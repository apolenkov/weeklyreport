# CustomReport Design System

This document extracts the visual system already shipped by `packages/ui` and
`apps/web`. It is a source-of-truth description, not a new visual direction:
new UI should reuse these tokens and primitives before adding another local
value.

## 1. Atmosphere & Identity

CustomReport is a calm operational paper surface with editorial-industrial
character. The working UI is light, warm, and information-dense without being
harsh: pale sage paper, cream cards, forest-green actions, muted slate/amber
status cues, and a restrained grid texture. The signature is the contrast
between that quiet paper report shell and the landing hero's dark forest
gradient, dot grid, and thin gold horizon line. Brand green means a forward
commit action; neutral slate-green means selection or framing. The product uses
depth and hierarchy rather than a saturated dashboard rainbow.

## 2. Color

### Palette

The palette is authored in `packages/ui/src/styles/theme.css` as CSS custom
properties. Values are hex or `rgba()`; this is not an OKLCH palette. The
application imports the package stylesheet through
`apps/web/src/styles/app.css`.

| Role                  | Token                                                                                       | Exact current value                                                         | Usage                                            |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| Page paper            | `--color-background`                                                                        | `#eef1ec`                                                                   | Body and base report background                  |
| Main text             | `--color-foreground`                                                                        | `rgba(0, 0, 0, 0.87)`                                                       | Body and headings                                |
| Muted surface         | `--color-muted`                                                                             | `#e2e6df`                                                                   | Secondary controls and selected neutral surfaces |
| Muted text            | `--color-muted-foreground`                                                                  | `rgba(0, 0, 0, 0.62)`                                                       | Captions, hints, inactive controls               |
| Accent surface        | `--color-accent`                                                                            | `#dbe2d8`                                                                   | Hover and accent utility surface                 |
| Accent text           | `--color-accent-foreground`                                                                 | `rgba(0, 0, 0, 0.87)`                                                       | Text on accent                                   |
| Quiet surface         | `--color-surface-muted`                                                                     | `#f7f8f4`                                                                   | Low-emphasis grouped content                     |
| Hover surface         | `--color-surface-hover`                                                                     | `#f8f6f2`                                                                   | Hover fills and toolbar frame                    |
| Empty surface         | `--color-surface-empty`                                                                     | `#fafaf7`                                                                   | Empty states and neutral shell interiors         |
| Card                  | `--color-card`                                                                              | `#fffefb`                                                                   | Elevated cards, tables, skeleton containers      |
| Card text             | `--color-card-foreground`                                                                   | `rgba(0, 0, 0, 0.87)`                                                       | Text on cards                                    |
| Popover               | `--color-popover`                                                                           | `#ffffff`                                                                   | Dialog, menu, and popover surfaces               |
| Popover text          | `--color-popover-foreground`                                                                | `rgba(0, 0, 0, 0.87)`                                                       | Text in popovers                                 |
| Border                | `--color-border`                                                                            | `#ccd4c8`                                                                   | Default controls and dividers                    |
| Warm hairline         | `--color-border-warm`                                                                       | `#ece8e2`                                                                   | Login-card and role-picker boundaries            |
| Subtle border         | `--color-border-subtle`                                                                     | `rgba(0, 0, 0, 0.08)`                                                       | Hairlines and report toolbar frames              |
| Strong border         | `--color-border-strong`                                                                     | `rgba(0, 0, 0, 0.2)`                                                        | Emphasized outline controls                      |
| Accent border hover   | `--color-border-accent-hover`                                                               | `rgba(0, 117, 74, 0.3)`                                                     | Hovered product/action outlines                  |
| Focus ring            | `--color-ring`                                                                              | `rgba(0, 98, 65, 0.3)`                                                      | Focus halo and ring token                        |
| Primary action        | `--color-primary` / `--color-starbucks-green`                                               | `#006241`                                                                   | Forward actions, headings, chart 1               |
| Primary foreground    | `--color-primary-foreground`                                                                | `#ffffff`                                                                   | Text and icons on primary                        |
| Accent action         | `--color-starbucks-accent`                                                                  | `#00754a`                                                                   | Primary button fills, active nav accent, chart 2 |
| Gold                  | `--color-starbucks-gold`                                                                    | `#cba258`                                                                   | Brand/gold accent and chart 3                    |
| Secondary surface     | `--color-secondary`                                                                         | `#e2e6df`                                                                   | Secondary controls                               |
| Secondary text        | `--color-secondary-foreground`                                                              | `#1e3932`                                                                   | Text on secondary                                |
| Success surface       | `--color-success`                                                                           | `#d8ece4`                                                                   | On-track and positive state fills                |
| Success text          | `--color-success-foreground`                                                                | `#006241`                                                                   | Positive state text and saved icon               |
| Warning               | `--color-warning`                                                                           | `#fbbc05`                                                                   | Deadline and warning accents                     |
| Destructive           | `--color-destructive`                                                                       | `#c82014`                                                                   | Errors, blocked state, destructive actions       |
| Destructive emphasis  | `--color-destructive-emphasis` / `--color-destructive-emphasis-hover`                       | `#991b1b` / `#7f1d1d`                                                       | Required marks and compact destructive controls  |
| Destructive text      | `--color-destructive-foreground`                                                            | `#ffffff`                                                                   | Text on destructive                              |
| Overlay               | `--color-overlay`                                                                           | `rgba(0, 0, 0, 0.5)`                                                        | Dialog/backdrop overlay                          |
| Selected neutral      | `--color-toggle-active`                                                                     | `#3f4a44`                                                                   | Segmented control active state                   |
| Skeleton              | `--color-skeleton`                                                                          | `#d8ddd4`                                                                   | Loading shimmer base                             |
| On-track chip         | `--color-chip-on-track-bg` / `--color-chip-on-track-text` / `--color-chip-on-track-border`  | `#d8ece4` / `#1e4a36` / `#4a9470`                                           | Identity/status chip trio                        |
| At-risk chip          | `--color-chip-at-risk-bg` / `--color-chip-at-risk-text` / `--color-chip-at-risk-border`     | `#ede8d8` / `#504020` / `#987040`                                           | Identity/status chip trio                        |
| Blocked chip          | `--color-chip-blocked-bg` / `--color-chip-blocked-text` / `--color-chip-blocked-border`     | `#ecdcda` / `#6a1e1a` / `#a84040`                                           | Identity/status chip trio                        |
| Blocked status fill   | `--color-status-blocked-bg`                                                                 | `#fee2e2`                                                                   | Blocked status background                        |
| At-risk status        | `--color-status-at-risk-bg` / `--color-status-at-risk-fg` / `--color-status-at-risk-border` | `#fef3c7` / `#78350f` / `#a07c30`                                           | At-risk status background, text, border          |
| In-progress status    | `--color-status-in-progress-bg` / `--color-status-in-progress-fg`                           | `#e9eff3` / `#436079`                                                       | Steel-blue progress state                        |
| Period scheduled      | `--color-period-scheduled-bg` / `--color-period-scheduled-fg`                               | `#e5e7eb` / `#374151`                                                       | Scheduled lifecycle badge                        |
| Period published      | `--color-period-published-bg` / `--color-period-published-fg`                               | `#e8e0f0` / `#6b21a8`                                                       | Published lifecycle badge                        |
| Period archived       | `--color-period-archived-bg` / `--color-period-archived-fg`                                 | `#f3f4f6` / `#6b7280`                                                       | Archived lifecycle badge                         |
| Priority row          | `--color-priority-row-bg`                                                                   | `#faf6ee`                                                                   | Priority record tint                             |
| Highlight shadow      | `--color-highlight-shadow`                                                                  | `rgba(0, 117, 74, 0.16)`                                                    | Accent highlight halo                            |
| At-risk dot           | `--color-status-dot-at-risk`                                                                | `#d4a017`                                                                   | Small status indicator                           |
| Decisions accent      | `--color-decisions-accent`                                                                  | `#4a7494`                                                                   | Decision state kept distinct from success        |
| Stage DevOps          | `--color-stage-devops`                                                                      | `#6366f1`                                                                   | JS-only stage token preserved in `:root`         |
| Chart series          | `--color-chart-1` … `--color-chart-7`                                                       | `#166534`, `#2563eb`, `#9333ea`, `#0e7490`, `#78350f`, `#a21caf`, `#475569` | Recharts series                                  |
| On-dark text          | `--color-on-dark`                                                                           | `#f2f0eb`                                                                   | Text on deep brand surfaces                      |
| Landing deep          | `--pulse-deep` / `--pulse-mid` / `--pulse-tip`                                              | `#0c2620` / `#006241` / `#00754a`                                           | Dark landing gradient; app-specific layer        |
| Landing author colors | `--slide-author-0` … `--slide-author-5`                                                     | `#d6e5dc`, `#d8e4f0`, `#e4dcee`, `#d5eae8`, `#e8e3d9`, `#f0dee3`            | Pastel author identity colors                    |

The theme also defines reusable surface recipes: `--card-surface-border` is
`rgba(0, 0, 0, 0.1)`, `--card-surface-gradient` runs from white at 97%
opacity to white at 94%, and the paired `--card-surface-shadow` / hover
shadow provide card elevation. `--toolbar-band-gradient` is a translucent
white vertical gradient for chrome rather than a card.
The login primary action uses `--shadow-primary-cta`; app code must not restate
its brand-green shadow or the warm login hairline as literal color values.

The product uses the current light palette only. Deep brand surfaces use the
`--color-on-dark` text token where light text is required for contrast.

### Rules

- Use the semantic token that matches the surface or state; generic surface
  coloring is not part of the current token contract.
- Brand green is the single forward-commit meaning. Neutral segmented active
  states use `--color-toggle-active`; reversal/lifecycle controls remain
  neutral or outlined.
- Empty panels use `--color-surface-empty`; solid elevated cards, tables, and
  skeleton containers use `--color-card`.
- Accent foregrounds are explicit light/dark foreground tokens; do not rely on
  browser fallback colors.

## 3. Typography

### Font stack

The root layout loads all three Google faces through `next/font/google` and
puts their CSS variables on `<html>`:

- **Display**: `Fraunces` through `--font-display`, with `"Times New Roman",
serif` fallback. The landing `PulseMark` uses this for the WEEKLY/REPORT
  wordmark.
- **UI sans**: `Lexend`, then `Source Sans 3`, then `ui-sans-serif, system-ui,
sans-serif`, through `--font-sans`.
- **Mono**: `"Geist Mono", ui-monospace, monospace` through `--font-mono`.

`body` uses `font-sans`, antialiasing, and `tracking-[-0.01em]`. The app
keeps the hierarchy compact rather than exposing a separate display-size scale:

| Surface              | Current size/weight evidence                                                                          | Usage                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Landing wordmark     | `.pulse-strong`: `clamp(4rem, 9vw + 1rem, 8.5rem)`, weight 560, line-height `.86`, tracking `-.025em` | Report hero focal mark                    |
| Landing eyebrow      | `.pulse-word`: `clamp(.95rem, 1vw + .5rem, 1.35rem)`, uppercase, `0.22em` tracking                    | WEEKLY label                              |
| Landing tagline      | `clamp(.9rem, .6vw + .7rem, 1.05rem)`, line-height `1.5`                                              | Rotating supporting copy                  |
| Page title           | Usually `text-2xl` (`1.5rem`) semibold with tight tracking                                            | Status Report and major shells            |
| Card/section heading | `text-lg` or `text-base` semibold                                                                     | Cards, accordions, dialogs                |
| Body                 | `text-sm` (`.875rem`) and `text-base` (`1rem`)                                                        | Controls and report content               |
| Metadata             | `text-xs` / `text-[11px]` / `text-[10px]`                                                             | Captions, stage labels, identity metadata |
| Slide display        | Owner title `text-xl` (`1.25rem`); row body `13px`; metadata `10–12px`                                | Slide deck canvas                         |
| Chart tooltip        | `--font-size-chart-tooltip: .75rem`                                                                   | Chart overlay                             |

The system has intentional compact labels below 14px for metadata and status
chips; do not use those sizes for body copy or interactive labels.

## 4. Spacing & Layout

### Base and density

There is no bespoke `--space-*` variable family. Layout uses Tailwind CSS v4's
quarter-rem spacing scale (the practical base unit is 4px) plus CSS mechanics
such as `gap`, `clamp()`, intrinsic tracks, and viewport/container sizing.
Common current values are `gap-1.5` (6px) for control clusters, `gap-2` (8px)
for icon/label pairs, `gap-3` (12px) for card/header content, `gap-4` (16px)
for shell sections, and `p-5`/`p-6` (20/24px) for report/card surfaces.

### Page geometry

- The shared navigation and primary app frame use `max-w-7xl` (80rem / 1280px)
  with `px-4` (16px), `sm:px-6` (24px), and `lg:px-8` (32px).
- Report shells use vertical `space-y-4`; page headers wrap with `gap-4` and
  document actions stay in a labelled `DocumentActionGroup`.
- Context controls live in a separately bordered `ReportToolbar`: `px-2`,
  `py-1.5`, and `gap-1.5`. The toolbar and its labelled groups wrap at narrow
  widths so every action stays visible; a consumer may add an explicitly
  bounded inner scroll surface only when its content cannot reflow. Sticky
  toolbars use `top-0`, `z-20`, an opaque surface, and `shadow-md`.
- The default toolbar control height is `--toolbar-control-h: 2rem` (32px).
  Under `width < 48rem` (768px), it becomes `--touch-target-min: 44px`.
  Primary mobile controls explicitly use the 44px minimum.
- Dashboard queue actions use two stable component tokens:
  `--dashboard-summary-action-w: 5.5rem` for each summary-row action track and
  `--dashboard-detail-action-w: 9.25rem` for each expanded-row action cell.
  Both tiers use `--dashboard-action-h: var(--touch-target-min)` so labels,
  icons, pending copy, and disclosure state never change the outer geometry.
- Standard Tailwind breakpoints are used in components: `sm` 640px, `md`
  768px, `lg` 1024px, and `xl` 1280px. The CSS media query for toolbar density
  is explicitly below 48rem.
- Presentation uses the full available desktop report-frame width, with a 900px
  minimum width and a tokenized 360px minimum height. The canvas and its
  content-driven rows grow vertically when needed, so compact decks do not
  reserve poster-like blank space or clip complete record text. Slide canvases
  use 20px padding.
- The body has a layered white-to-transparent wash over a 32px square grid.
  `operational-paper-shell` adds a white vertical wash, 10rem green vertical
  rhythm, 2rem paper lines, and a quiet gold wash.

### Layout primitives

Use the existing spatial grammar: centered max-width frames, vertical stack
(`space-y-*`), flex cluster rows, responsive grids, sticky context bars, and
intrinsic `minmax(0, 1fr)` tracks. A toolbar may own horizontal scroll at
narrow widths; primary report content should reflow rather than clip.

## 5. Components

The shared layer has two component families: package primitives in
`packages/ui` and report/navigation primitives in `apps/web/src/shared/ui`.
The state contracts below describe what the current code already provides.

### Button and action controls

- **Structure**: native button or Radix `Slot` when `asChild` is requested.
- **Variants**: `default`, `destructive`, `outline`, `secondary`,
  `ghost`, and `link`; sizes `default`, `xs`, `sm`, `lg`, `touch`,
  `icon`, `icon-xs`, `icon-sm`, and `icon-lg`.
- **States**: hover fill/text, active press (`.btn-press` where used),
  `focus-visible` border/ring, `aria-invalid`, disabled opacity/cursor, and
  loading states owned by callers such as `SaveNowButton`.
- **Accessibility**: native keyboard semantics, visible focus ring, disabled
  pointer guard, decorative SVGs hidden from the accessibility tree, and 44px
  `touch`/mobile sizing.
- **Motion/layout**: compact rounded-md package buttons; report actions use
  rounded-pill clusters and flex-wrap rows. Within a Dashboard queue tier,
  controls fill the complete tokenized action cell and share one height;
  content length must not shrink or enlarge an individual control.

### Card and surface primitives

- **Structure**: `Card` with `CardHeader` and `CardContent`; report cards use
  the shared `.card-surface` utility.
- **Variants/states**: card, elevated card, gradient fill, hover shadow,
  skeleton, empty (`--color-surface-empty`), and error/alert content.
- **Spacing**: package card `gap-6`, `py-6`, `px-6`; report accordion
  surfaces use `p-5` headers and `px-5 pb-5 pt-2` bodies.
- **Accessibility/layout**: semantic heading/description slots are supplied by
  callers; cards stay in responsive grid/stack layouts and preserve content
  height under loading.
- **Motion**: hover `box-shadow` transition; skeleton shimmer for loading.

### Forms and selection

- **Structure**: `Label` + `Input`/`Textarea`/`Select` and shared
  `TabSearch` or `SearchInput` wrappers. Selects and menus are Radix
  primitives.
- **Variants/states**: placeholder, hover, focus-visible ring, invalid border
  and ring, disabled opacity/cursor, open/closed menu, selected/active option,
  and loading/error states at the form owner.
- **Spacing/accessibility**: controls use compact 32–36px desktop heights and
  a 44px mobile floor; labels, `aria-invalid`, `aria-describedby`, and
  keyboard listbox/dialog behavior are explicit.

### Dialog, sheet, and confirmation surfaces

- **Structure**: package `Dialog`/`DialogContent` uses a portal, overlay,
  labelled title/description, footer, and close button. Web
  `DialogSurface`/`ConfirmationDialog` provides a target/currentTarget
  backdrop guard, a portal, and `useDialogFocus`.
- **Variants/states**: default/destructive confirmation, open/closed overlay,
  pending actions that suppress dismissal, escape/close-button dismissal,
  focus trapping, and scrollable narrow dialogs.
- **Accessibility**: `role="dialog"` or `alertdialog`, `aria-modal`, explicit
  label/labelledby/describedby, visible close control, Escape support, and
  focus restoration are part of the current contract.
- **Motion/layout**: centered max-width surfaces, overlay fade, zoom/fade
  enter/exit, and responsive footer stacking.

### Report shell controls

- **`ReportToolbar` / `DocumentActionGroup`**: context controls are a
  labelled wrapping chrome row; document actions are a separate wrapping
  labelled group. At mobile widths every control remains visible without
  document-level horizontal overflow. The document-vs-context split keeps one
  forward primary.
- **`AccordionSection`**: card-surface accordion with title icon, optional
  badge/subtitle/actions, two synchronized toggles, `aria-expanded`,
  `aria-controls`, inert collapsed body, and a 300ms grid-row transition.
- **`SegmentedToggle` / `ViewModeToggle` / `ScopeToggle`**: pill track,
  neutral selected fill (`--color-toggle-active`), inactive muted text, and
  labelled group/radiogroup semantics. View links preserve open-in-new-tab.
- **`ToolbarIconButton` / `ArchiveToggle` / `LockBadge`**: compact round
  controls, required accessible names, visible focus rings, read-only/checked
  semantics, and Lucide icons.
- **`SaveNowButton`**: idle, pending, saved flash, error/retry states; saved
  flash lasts 1500ms and timers are cleaned up. Busy is the only transient
  accent-green toolbar exemption.
- **`MetaRow`**: author + stage chip cluster; empty stage list renders the
  explicit “All stages” chip and foreign ownership is announced as read-only.

### Feedback and data states

- **Alert/Toast**: `Alert` has default/destructive variants and
  `role="alert"`; `Toaster` maps success/info/warning/error/loading to Lucide
  icons and follows the current theme.
- **Badge**: pill labels with default/secondary/destructive/outline/ghost/link
  variants.
- **Skeleton/Progress**: shimmer placeholders and determinate progress bars;
  report/admin/slide skeletons mirror the eventual shell to reduce layout shift.
- **Empty/error**: empty surfaces use `--color-surface-empty`; query owners
  render labelled retry/error alerts rather than silent fallback content.

### Navigation

`NavBar` is a centered three-column grid with brand/identity left, desktop
links in the center, and the right rail. Desktop links are pill-shaped with an
active success/green fill; mobile navigation switches to a Radix Sheet with a
44px trigger. A 3px accent-green horizon line anchors the header, and all icon
only controls carry accessible names.

## 6. Motion & Interaction

| Interaction       | Current timing/effect                                                     | Meaning                        |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------ |
| Skeleton          | `skeleton-shimmer` 1.8s ease-in-out, background-position sweep            | Data is loading                |
| Fade entry        | `.animate-fade-in` 400ms ease-out, opacity + `translateY(8px)`            | Content enters the shell       |
| Scale entry       | `.animate-scale-in` 200ms ease-out, opacity + `scale(.95)`                | Dialog/surface appears         |
| Accordion         | `grid-template-rows` 300ms; chevron transform 300ms                       | Expand/collapse state          |
| Dialog/menu/sheet | Radix/Tailwind animate-in/out; dialog 200ms, sheet open 500ms/close 300ms | Layer enters/exits             |
| Button press      | `.btn-press:active` `scale(.95)`                                          | Immediate press feedback       |
| Tagline cycler    | 3000ms visible, 250ms opacity fade                                        | Landing copy rotates           |
| Risk pulse        | `risk-pulse` 1.6s ease-in-out infinite, opacity + scale                   | Active blocker draws attention |
| SDLC pulse        | `sdlc-pulse` 3s infinite, accent box-shadow                               | Empty/editable stage cue       |
| Toast loading     | Lucide loader `animate-spin`                                              | Pending async action           |

The current reduced-motion rule disables package fade/scale/stagger/skeleton/
collapsible animations and button press transforms, restoring opacity and
transform. New motion must preserve that rule, use transform/opacity when the
effect can be composited, and remain tied to a state or affordance rather than
decorative motion.

## 7. Depth & Surface

The system uses a **mixed** strategy:

1. **Tonal paper**: `--color-background` plus the body grid and
   `operational-paper-shell` gradients establish a quiet page plane.
2. **Card material**: `.card-surface` combines a 1px translucent border, a
   white two-stop gradient, and a three-layer soft shadow. Hover adds a slightly
   larger shadow; it does not recolor the card.
3. **Chrome**: report toolbars use a translucent white gradient and subtle
   border; sticky toolbars become opaque and gain `shadow-md` so content cannot
   bleed through. Segmented controls use a neutral dark-slate active capsule.
4. **Modal layers**: overlays use `--layer-overlay: 50`, popovers use
   `--layer-popover: 50`, dialogs use `--layer-dialog: 100`; dialog/popover
   surfaces use `--color-popover`/`--color-background` with
   `shadow-lg`/`shadow-xl`.
5. **Brand depth**: the landing panel uses a dark forest multi-stop gradient,
   radial shading, a 32px dot grid, and a fine gold horizon line. This is the
   signature focal surface, not a generic flat hero.

Do not replace these layers with a single flat fill or a one-off shadow. Do not
use primary green as a decorative background when the control is not a forward
action.

## 8. Accessibility constraints

### Constraints

- Target WCAG 2.2 AA: body text requires a 4.5:1 contrast floor, large text
  3:1, and UI boundaries/focus indicators 3:1 where the criterion applies.
  The token contract intentionally pairs white
  `--color-primary-foreground` with green primary fills and white destructive
  foreground with `--color-destructive`; verify any new token pair rather than
  assuming it.
- Every interactive control must be keyboard reachable and expose a visible
  focus-visible treatment. Shared buttons/inputs/selects use the ring token;
  report controls require `aria-label` or visible text; decorative icons use
  `aria-hidden="true"`.
- Dialogs must expose role, modal state, name/description, Escape or close-button
  dismissal, and focus management. Accordions and toggles must expose their
  expanded/pressed/checked state and control relationship.
- Touch targets use the 44px minimum below the mobile density breakpoint.
  Primary mobile actions, navigation triggers, search, and dialog actions must
  not fall below that floor.
- Loading, empty, and error states are explicit in
  the DOM (`role="status"`, `role="alert"`, `aria-busy`, or
  `aria-disabled`) and must not be conveyed by color alone.
- Respect `prefers-reduced-motion: reduce`; never add essential meaning that
  exists only in animation. Keep copy plain and preserve the skip-to-content
  link in the root layout.
- Focused product tests verify semantic accessibility behavior. Changed UI
  surfaces also receive direct keyboard, focus and contrast review when the
  product risk warrants it.
