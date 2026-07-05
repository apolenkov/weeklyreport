## ADDED Requirements

### Requirement: Inert Button Coming-Soon Controls Compose One Shared Chrome Primitive

The inert "coming soon" trigger chrome MUST be provided by a single shared
primitive in `@customreport/ui` (alongside `ComingSoonBadge`) that every inert
BUTTON deferred control composes; no consumer site may hand-roll the chrome. The
chrome is: the `ComingSoonTooltip` wrapper, an `aria-disabled="true"` (never
`disabled`) `<button type="button">`, the shared inert control classes
(`cursor-default`, the `--color-border` border, the `--color-surface-empty`
background, and the `--color-muted-foreground` foreground), and a single lucide
icon slot. The consumer supplies only the per-control differences — the icon,
the `aria-label` (of the form "<feature> is coming soon"), the `data-testid`, the
geometry (via a `shape` variant on the icon-only export, or the `compact` density
flag on the labelled export), and, where the control is text-labelled, the visible
label. Because the five controls share the primitive by composition, their parity
holds by construction and the previous per-file parity source scans in
`apps/web/src/components/coming-soon-style.test.tsx` no longer cover those five
files (the scans shrink to a holidays-only scope for the out-of-scope admin
Holidays control).

1. The five inert BUTTON deferred controls — agent-review, lead version, lead
   PDF-export, nav-bar language, and nav-bar theme — MUST render their chrome by
   composing the shared primitive, not by repeating the button markup and
   classes inline.
2. The primitive MUST expose an icon-only variant (for version, PDF-export,
   language, and theme) and a labelled variant carrying a visible text label and
   an optional `compact` density flag (for agent-review), so no consumer needs a
   bespoke chrome to cover its shape. Because the four icon-only sites span two
   distinct geometries — a `--toolbar-control-h` `rounded-full` square (version,
   PDF-export) and a fixed `h-8 w-10` `rounded-[var(--radius-pill)]` pill
   (language, theme) — the icon-only variant MUST carry a geometry selector (a
   `shape` prop) that reproduces both from within the primitive; the primitive
   owns the geometry classes, and no consumer supplies wrapper-side sizing or any
   `className`.
3. The nav-bar's `LanguageComingSoonControl` and `ThemeComingSoonControl` MUST be
   extracted so each is a thin wrapper that composes the shared primitive with
   its own icon, `aria-label`, and `data-testid`; the inline duplicated button
   markup is removed from `navigation/nav-bar.tsx`.
4. The primitive MUST keep every behavioural invariant the copies had: the
   canonical amber `ComingSoonBadge` tooltip via the Radix portal, the persistent
   `aria-label` as the single coming-soon announcement, `aria-disabled="true"`
   inertness, and no native `title="Coming Soon"`. This requirement changes only
   WHERE the chrome lives, not how it behaves.
5. The admin Holidays control is OUT OF SCOPE: it is an inert `<span>` nested in a
   `TabsTrigger` `<button>` (a nested `<button>` would be invalid HTML), so it
   keeps its own `ComingSoonTooltip` + sr-only `ComingSoonBadge` composition and
   MUST NOT adopt the button primitive.

#### Scenario: the five button controls share the primitive

- **WHEN** the codebase is checked for inert button deferred controls
- **THEN** agent-review, lead version, lead PDF-export, nav-bar language, and
  nav-bar theme each render their inert chrome by composing the shared
  `@customreport/ui` primitive
- **AND** none of those five sites repeats the `ComingSoonTooltip` wrapper, the
  `aria-disabled` button markup, or the shared inert classes inline

#### Scenario: the icon-only and labelled variants both come from the primitive

- **WHEN** an icon-only control (e.g. lead version) and the text-labelled
  agent-review control are rendered
- **THEN** the icon-only control uses the primitive's icon-only variant with its
  `shape` geometry selector and the agent-review control uses the primitive's
  labelled variant with its visible label and `compact` density flag
- **AND** the toolbar square and nav pill geometries both come from the
  primitive's `shape` variant, not from consumer-supplied classes
- **AND** neither control introduces chrome classes outside the primitive

#### Scenario: the nav-bar controls are extracted to thin wrappers

- **WHEN** the nav-bar renders its Language and Theme deferred controls
- **THEN** each is a thin wrapper composing the shared primitive with its own
  icon, `aria-label`, and `data-testid`
- **AND** `navigation/nav-bar.tsx` no longer carries the duplicated inert button
  markup and classes inline

#### Scenario: parity is enforced by the primitive, not by per-file source scans

- **WHEN** the primitive's behaviour (chrome, `aria-disabled`, absent native
  title, amber tooltip, icon slot) is verified
- **THEN** it is verified by one unit test on the shared primitive (living in
  `apps/web`, since `packages/ui` has no test runner)
- **AND** the five button files are dropped from the two per-file parity
  source-scan `describe` blocks (the "migrated to the shared Radix wrapper" scan
  and the "no stacked native title" scan), because those controls can no longer
  diverge from a chrome they no longer own
- **AND** those two scans are NOT deleted but shrink to a holidays-only scope over
  `admin/settings-tab.tsx`, so the out-of-scope Holidays control keeps its sr-only
  `ComingSoonBadge` and no-native-title guards
- **AND** the repo-wide no-bespoke-"Coming Soon"-pill scan and the render tests
  for the exported controls remain

#### Scenario: the holidays span keeps its own composition

- **WHEN** the admin Settings holidays tab is rendered
- **THEN** the holidays deferred control stays an inert `<span>` nested in its
  `TabsTrigger`, composing `ComingSoonTooltip` + a sr-only `ComingSoonBadge`
  directly
- **AND** it does not adopt the button chrome primitive

## MODIFIED Requirements

### Requirement: Inert Coming-Soon controls carry no stacked native title

Every inert Coming-Soon control MUST NOT carry a native `title="Coming Soon"` attribute, because the shared amber `ComingSoonBadge` already renders the control's only tooltip and a duplicate native `title` stacks a second browser-native tooltip on hover (the double-tooltip glitch). This rule covers all inert deferred controls: the nav Theme and Language controls, the lead-toolbar Agent-review, Version, and PDF-export controls, and the admin Holidays control. For the five inert BUTTON controls the title-absence guarantee now lives in the shared chrome primitive they compose — the primitive emits no native `title`, so no consumer can reintroduce one — rather than in five per-file source scans. The control's accessible name is carried by its `aria-label` (the focusable `<button>` controls) or by the `ComingSoonBadge` descendant text (the inert Holidays `<span>` nested inside its `TabsTrigger`), so removing the native title costs no accessible name. A control MAY still use a native `title` for OTHER wording (e.g. a logout button's `title="Sign out"`); only a `title` duplicating the badge's "Coming Soon" text is forbidden.

#### Scenario: a lead-toolbar deferred control shows one tooltip, not two

- **WHEN** a lead hovers the Agent-review, Version, or PDF-export Coming-Soon control on the report toolbar
- **THEN** only the amber `ComingSoonBadge` tooltip appears
- **AND** the control carries no native `title="Coming Soon"` attribute that would stack a second browser-native tooltip

#### Scenario: the shared primitive owns the no-title guarantee

- **WHEN** the shared chrome primitive is verified and the holidays span is checked
- **THEN** the primitive renders no native `title="Coming Soon"` attribute, so every button control composing it inherits the guarantee
- **AND** the admin Holidays `<span>`, which keeps its own composition, is still verified free of a native `title="Coming Soon"` by the retained holidays-scoped source scan over `admin/settings-tab.tsx`
- **AND** no per-file source scan over the five button control files is needed to enforce this, because those controls no longer own the chrome
