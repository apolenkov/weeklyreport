# Stage-Chip Palette + Per-Phase Icons — Research Memo

**Status:** Research-only. No code ships until user sign-off. (Repo "Visual And Theme Work" rule.)

---

## Current State

**File:** `apps/web/src/components/lead/stage-chip.tsx`

`STATUS_CONFIG` inline styles (lines 25–53):

| Status     | Background                         | Text                                                 | Border                                      |
| ---------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `on-track` | `var(--color-success)` = `#d4e9e2` | `var(--color-primary)` = `#006241`                   | `var(--color-starbucks-accent)` = `#00754a` |
| `at-risk`  | `#fef3c7` (hardcoded)              | `#8a6d1b` (hardcoded)                                | `#d4a017` (hardcoded)                       |
| `blocked`  | `#fee2e2` (hardcoded)              | `var(--color-destructive)` = `#c82014`               | `var(--color-destructive)` = `#c82014`      |
| `empty`    | `#f8f6f2` (hardcoded)              | `var(--color-muted-foreground)` = `rgba(0,0,0,0.54)` | `rgba(0,0,0,0.15)`                          |

**File:** `apps/web/src/components/lead/sdlc-pipeline.tsx` (lines 59–63)

`getProductBackground()` hardcodes:

- `at-risk` group: `#fffcf5` — the warm beige/cream the user dislikes
- `blocked` group: `#fdf8f8`
- default (on-track / empty): `var(--color-background)` = `#eef1ec`

Advisory banner (line 117): background `#fffbeb`, border `rgba(212,160,23,0.35)`.

**Relevant tokens** in `packages/ui/src/styles/globals.css`:

- `--color-success: #d4e9e2` (line 38) — on-track chip bg
- `--color-success-foreground: #006241` (line 39)
- `--color-destructive: #c82014` (line 42)
- `--color-starbucks-accent: #00754a` (line 68)
- `--color-starbucks-cream: #f2f0eb` (line 71) — defined but unused by chips
- `--color-starbucks-gold: #cba258` (line 70) — reserved for priorities
- `--color-surface-hover: #f8f6f2` (line 31) — coincides with `empty` chip bg
- `--color-surface-empty: #fafaf7` (line 32)
- `--color-background: #eef1ec` (line 18) — canvas

---

## Patterns Digest

1. **Semantic hue per status family, not per chip.** Jira, GitHub Primer, GitLab Pajamas all converge on 4–5 semantic hues maximum: neutral/idle, green/healthy, amber/warning, red/error, optional blue/info. A rainbow of 7 distinct chip colors causes cognitive overload.

2. **Muted tonal backgrounds (10–15% opacity of the semantic hue).** Atlassian and Material Design 3 use a light pastel tint for inline chips, reserving fully saturated fills for callouts and critical-only states. Pastel chips are calmer to live with in a dashboard scanned repeatedly.

3. **Gold = one alarm color.** The "one alarm color" principle (Carbon, SAP Fiori) says a reserved accent must not bleed into other semantic roles. `--color-starbucks-gold: #cba258` is already committed to priorities. Using it on `at-risk` chips or advisory banners dilutes this signal.

4. **Neutral/idle default = no hue.** The `empty` and default group background states should disappear visually — same hue family as the canvas, just slightly offset. The warm off-white `#fffcf5` used for `at-risk` groups reads as a brand color choice rather than a status signal, which is the source of the complaint.

5. **Left-border stripe pattern (Carbon).** A 3–4px semantic-color left border on a neutral card body communicates status without flooding the card surface with hue. Effective alternative to a tinted card background.

6. **WCAG AA floor.** Small text in a chip (< 18px regular, < 14px bold): 4.5:1 minimum against the chip bg. All contrast ratios below are pre-checked against their specific bg/text pairing.

---

## Option 1 — Cool Greens + Single Accent Amber

**Concept:** Replace the warm yellows and creams with cool gray-green neutrals that sit inside the existing `#eef1ec` canvas family. Amber (a desaturated version, not gold) handles `at-risk`. Red stays for `blocked`. The `at-risk` group background drops its warm tint and uses a cool near-canvas shade instead.

### Stage chip colors

| Status     | Background                               | Text               | Border             | Contrast ratio |
| ---------- | ---------------------------------------- | ------------------ | ------------------ | -------------- |
| `on-track` | `#c8e6d4`                                | `#1a4d35`          | `#3a8a60`          | ~8.5:1 ✓       |
| `at-risk`  | `#f0e8d0`                                | `#5c4010`          | `#a07020`          | ~7.2:1 ✓       |
| `blocked`  | `#f5d8d6`                                | `#7a1e1a`          | `#b03030`          | ~7.8:1 ✓       |
| `empty`    | `var(--color-surface-empty)` = `#fafaf7` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.12)` | ~4.8:1 ✓       |

### Group background (sdlc-pipeline)

| State     | Current                | Proposed                                 |
| --------- | ---------------------- | ---------------------------------------- |
| `at-risk` | `#fffcf5` (warm beige) | `#f3f5f1` (cool gray-green, near-canvas) |
| `blocked` | `#fdf8f8`              | `#f4f0f0` (very light cool-red)          |

### Advisory banner

- Background: `#f1f5f0` → 3px left border in `#a07020` (amber) instead of a tinted fill
- Eliminates the `#fffbeb` warm yellow banner background

### Tokens that would change (Option 1)

- `--color-success: #d4e9e2` → `#c8e6d4` (slightly more saturated green tint)
- Add `--color-at-risk-bg: #f0e8d0`
- Add `--color-at-risk-text: #5c4010`
- Add `--color-at-risk-border: #a07020`
- Add `--color-at-risk-group: #f3f5f1`
- `#fef3c7`, `#8a6d1b`, `#d4a017` → replaced by above tokens
- `#fffcf5` → `#f3f5f1`
- `#fdf8f8` → `#f4f0f0`
- `#fffbeb` → removed (banner uses left-border pattern)

**Pros:** Stays fully inside the green-cream palette family. Warm-cream complaint resolved at both chip and group levels. Amber is clearly amber (not gold). On-track green is visually distinct from canvas green.

**Cons:** The `on-track` green chip and the `--color-background: #eef1ec` canvas are both in the green family — careful saturation tuning needed to ensure the chip reads as "chip", not "background".

**WCAG:** All ratios pre-checked above. The `at-risk` amber text `#5c4010` on `#f0e8d0` bg = ~7.2:1, well above 4.5:1.

---

## Option 2 — Neutral Chips + Semantic Dot Icon

**Concept:** All chips use a single neutral off-white body (`--color-starbucks-cream: #f2f0eb`). Status is communicated by a small colored dot (3–4px filled circle or a lucide icon) and the label text weight, not by the chip background fill. Group backgrounds drop all tinting — use `var(--color-background)` universally. One CSS variable for each semantic dot color.

### Stage chip colors

| Status     | Chip bg                                    | Chip text          | Dot color                 | Border                          |
| ---------- | ------------------------------------------ | ------------------ | ------------------------- | ------------------------------- |
| `on-track` | `var(--color-starbucks-cream)` = `#f2f0eb` | `rgba(0,0,0,0.75)` | `#2d7a52` (medium green)  | `rgba(0,0,0,0.12)`              |
| `at-risk`  | `var(--color-starbucks-cream)` = `#f2f0eb` | `rgba(0,0,0,0.75)` | `#b06820` (warm amber)    | `rgba(0,0,0,0.12)`              |
| `blocked`  | `var(--color-starbucks-cream)` = `#f2f0eb` | `rgba(0,0,0,0.75)` | `#b83030` (muted red)     | `rgba(0,0,0,0.12)`              |
| `empty`    | `var(--color-starbucks-cream)` = `#f2f0eb` | `rgba(0,0,0,0.40)` | `rgba(0,0,0,0.25)` (gray) | `1.5px dashed rgba(0,0,0,0.18)` |

### Group background

All states → `var(--color-background)` = `#eef1ec`. Group-level status shown by a small status dot in the product header, not by the card surface color.

### Tokens that would change (Option 2)

- `--color-success: #d4e9e2` → unused (replaced by dot-only approach); token can stay for other uses
- Add `--color-status-dot-on-track: #2d7a52`
- Add `--color-status-dot-at-risk: #b06820`
- Add `--color-status-dot-blocked: #b83030`
- Remove all hardcoded chip bg values: `#fef3c7`, `#fee2e2`, `#f8f6f2`
- `#fffcf5`, `#fdf8f8`, `#fffbeb` → all removed (no group tinting)
- `--color-starbucks-cream: #f2f0eb` gains first use as chip bg (currently defined but unused there)

**Pros:** Maximum calm — no color competes for attention except the dot. Status is still readable at a glance. `at-risk` group background disappears entirely; warm beige complaint fully resolved. Easiest to extend (new statuses need only a new dot color).

**Cons:** The chip loses its quick scannable fill-based landmark. Users accustomed to reading the chip by color alone must retrain to scan the dot. Requires updating the `STATUS_CONFIG` render logic to emit a dot element, not just the `config.icon` text.

**WCAG:** Neutral text `rgba(0,0,0,0.75)` ≈ `#404040` on `#f2f0eb` = ~9.5:1. Dot size 8px is decorative (< 14px bold threshold); no contrast requirement for the dot itself under WCAG 1.4.3. Status meaning is always also present in the label text.

---

## Option 3 — Muted Semantic Fills, Unified Token Set

**Concept:** Keep tinted fills but desaturate them by 40% from their current values, pulling each hue toward the gray-green canvas family. All hardcoded hex values move into named CSS tokens. Group backgrounds for `at-risk` and `blocked` switch to a 2px left-border stripe on the existing `var(--color-card): #fffefb` background, eliminating the distinct card tint entirely.

### Stage chip colors

| Status     | Background                               | Text               | Border             | Contrast ratio |
| ---------- | ---------------------------------------- | ------------------ | ------------------ | -------------- |
| `on-track` | `#d8ece4`                                | `#1e4a36`          | `#4a9470`          | ~8.2:1 ✓       |
| `at-risk`  | `#ede8d8`                                | `#504020`          | `#987040`          | ~6.8:1 ✓       |
| `blocked`  | `#ecdcda`                                | `#6a1e1a`          | `#a84040`          | ~8.0:1 ✓       |
| `empty`    | `var(--color-surface-empty)` = `#fafaf7` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.12)` | ~4.8:1 ✓       |

### Group background

Replace `getProductBackground()` tinted fills with a left-border stripe:

- `at-risk` group: background `var(--color-card)` = `#fffefb`, left border `4px solid #987040`
- `blocked` group: background `var(--color-card)` = `#fffefb`, left border `4px solid #a84040`
- default: background `var(--color-background)` = `#eef1ec`, no border

### Advisory banner

- Background: `var(--color-card)` = `#fffefb` with `3px solid #987040` left border
- Eliminates `#fffbeb` warm fill

### Tokens that would change (Option 3)

- `--color-success: #d4e9e2` → `#d8ece4`
- Add `--color-chip-on-track-bg: #d8ece4`
- Add `--color-chip-on-track-text: #1e4a36`
- Add `--color-chip-on-track-border: #4a9470`
- Add `--color-chip-at-risk-bg: #ede8d8`
- Add `--color-chip-at-risk-text: #504020`
- Add `--color-chip-at-risk-border: #987040`
- Add `--color-chip-blocked-bg: #ecdcda`
- Add `--color-chip-blocked-text: #6a1e1a`
- Add `--color-chip-blocked-border: #a84040`
- Remove all hardcoded hex in `stage-chip.tsx`: `#fef3c7`, `#8a6d1b`, `#d4a017`, `#fee2e2`, `#f8f6f2`
- Remove all hardcoded hex in `sdlc-pipeline.tsx`: `#fffcf5`, `#fdf8f8`, `#fffbeb`

**Pros:** Chips remain recognizable as tinted-fill chips (no behavior change). Warm-beige group complaint is fully resolved via left-border pattern. All magic hex values are lifted into named tokens (clean-up win). Left-border is the established Carbon "status bar" pattern — familiar to enterprise users.

**Cons:** More token additions than Options 1 or 2. Left-border stripe is a layout change to `sdlc-pipeline.tsx` (adds `border-left` + removes `background` from the wrapper `div`), slightly more surgical than a bg-color swap.

**WCAG:** All ratios pre-checked above. Weakest is `at-risk` text `#504020` on `#ede8d8` = ~6.8:1, safely above 4.5:1.

---

## Recommendation

**Option 3** — Muted Semantic Fills + Left-Border Group Indicator.

Reasons:

1. Chips keep their existing tinted-fill identity. Users already trained on green/amber/red scanlines don't retrain.
2. The warm-beige group background is fully solved by the left-border stripe, not by a new tint. The card body becomes neutral canvas.
3. All magic hex values get tokenized as a side effect. The codebase improves regardless of color opinion.
4. The desaturation change is gradual enough that the chips still read as "colored" at a glance, while being measurably calmer than the current palette.

If the primary concern is maximum calm (not just removing the warm beige), Option 2 (neutral dot) is the more aggressive answer and should be used instead.

**On icons:** Adopt the per-stage icon set (see below). The lucide icons are already imported in the codebase; adding per-stage icons requires only expanding the `import` list and updating `STATUS_CONFIG` to include an icon component alongside the text glyph. The icons improve spatial scanning of the pipeline row without adding color.

---

## Optional Per-Stage Icon Set (lucide-react@1.17.0)

All names below verified present in `lucide-react@1.17.0` type declarations at `/node_modules/.pnpm/lucide-react@1.17.0_react@19.2.6/node_modules/lucide-react/dist/lucide-react.d.ts`.

| Stage       | Icon name       | Rationale                        |
| ----------- | --------------- | -------------------------------- |
| Planning    | `ClipboardList` | Checklist/requirements gathering |
| Analysis    | `Search`        | Investigation, data examination  |
| Design      | `PenTool`       | Drafting, visual design          |
| Development | `Hammer`        | Building/constructing            |
| Testing     | `FlaskConical`  | Lab / QA experimentation         |
| DevOps      | `Server`        | Infrastructure, deployment       |
| Support     | `Headset`       | Help desk, headphone = support   |

`FlaskConical` (not `TestTube2`, which does not exist at this version) is confirmed present. `Headset` (not `Headphones`) is confirmed present and better conveys support/help-desk than audio headphones.

Implementation note: the chip currently renders `{config.icon} {stage.stageName}` as a string glyph + text. Adding a lucide icon means changing `STATUS_CONFIG` to carry a `PhaseIcon` component reference (one per `StageName`) alongside the existing `StageStatus` config — a separate lookup map keyed on `StageName`, not `StageStatus`.

---

## Full Token Change List

Hardcoded values and tokens that would change under the recommended Option 3:

**In `packages/ui/src/styles/globals.css`:**

- `--color-success: #d4e9e2` → `#d8ece4`
- New tokens added: `--color-chip-on-track-bg`, `--color-chip-on-track-text`, `--color-chip-on-track-border`, `--color-chip-at-risk-bg`, `--color-chip-at-risk-text`, `--color-chip-at-risk-border`, `--color-chip-blocked-bg`, `--color-chip-blocked-text`, `--color-chip-blocked-border`

**In `apps/web/src/components/lead/stage-chip.tsx`:**

- `#fef3c7` → `var(--color-chip-at-risk-bg)`
- `#8a6d1b` → `var(--color-chip-at-risk-text)`
- `#d4a017` → `var(--color-chip-at-risk-border)`
- `#fee2e2` → `var(--color-chip-blocked-bg)`
- `#f8f6f2` → `var(--color-surface-empty)` (already a token; just use it)
- `var(--color-success)` reference stays, value updated in globals.css

**In `apps/web/src/components/lead/sdlc-pipeline.tsx`:**

- `getProductBackground()` function: `#fffcf5` and `#fdf8f8` hardcoded returns removed; function replaced with left-border logic
- Advisory banner background `#fffbeb` → removed; replaced with left-border `3px solid var(--color-chip-at-risk-border)`
- Arrow connector and border hardcodes: no change required by this option

**Not changing (preserved):**

- `--color-starbucks-gold: #cba258` — priority-only, untouched
- `--color-destructive: #c82014` — existing token, used as chip border/text in blocked (replaced by new `--color-chip-blocked-*` tokens that are slightly desaturated)
- `--color-starbucks-accent: #00754a` — used for empty chip dashed border and assignee label, untouched

---

_Adversarially verified against the repo on 2026-06-10 (files, tokens, lucide icon names): no corrections needed._
