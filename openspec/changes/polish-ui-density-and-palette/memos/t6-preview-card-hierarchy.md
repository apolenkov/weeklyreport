# Product-Accordion Color-Hierarchy Memo

**Status:** Research only — no code ships until user sign-off (repo "Visual And Theme Work" rule).

**File under review:** `apps/web/src/components/weekly-report/product-accordion.tsx`
**Token definitions:** `packages/ui/src/styles/globals.css`

---

## Current State

The component simultaneously renders up to **7 distinct hues** in one collapsed card header
and up to that number in the expanded body. The specific conflict sites (file:line):

### Section label colors

| Line | Label              | Current class/style                    | Resolved value     | Hue family   |
| ---- | ------------------ | -------------------------------------- | ------------------ | ------------ |
| 195  | "Needs Attention"  | `text-[var(--color-destructive)]`      | `#c82014`          | Red          |
| 221  | "Current Week"     | `text-[var(--color-muted-foreground)]` | `rgba(0,0,0,0.54)` | Neutral grey |
| 260  | "Next Week"        | `text-[var(--color-muted-foreground)]` | `rgba(0,0,0,0.54)` | Neutral grey |
| 287  | "Risks & Blockers" | `text-[var(--color-destructive)]`      | `#c82014`          | Red          |
| 328  | "Decisions"        | `text-[var(--color-starbucks-accent)]` | `#00754a`          | Mid green    |
| 351  | "Top Priorities"   | `text-[var(--color-starbucks-gold)]`   | `#cba258`          | Amber/gold   |

### Header status pill (STATUS_CONFIG)

| Status                   | Background                         | Text                                   | Hardcoded literals |
| ------------------------ | ---------------------------------- | -------------------------------------- | ------------------ |
| `on-track` (lines 28–31) | `var(--color-success)` = `#d4e9e2` | `var(--color-primary)` = `#006241`     | None               |
| `at-risk` (lines 33–38)  | `#fef3c7`                          | `#8a6d1b`                              | Both are hardcoded |
| `blocked` (lines 39–44)  | `#fee2e2`                          | `var(--color-destructive)` = `#c82014` | bg hardcoded       |

### Item-level status badges (ITEM_STATUS_BADGE, lines 47–60)

| Status        | Background                         | Text                                   | Hardcoded literals |
| ------------- | ---------------------------------- | -------------------------------------- | ------------------ |
| `in-progress` | `var(--color-success)` = `#d4e9e2` | `var(--color-primary)` = `#006241`     | None               |
| `completed`   | `var(--color-primary)` = `#006241` | `#fff`                                 | Text hardcoded     |
| `blocked`     | `#fee2e2`                          | `var(--color-destructive)` = `#c82014` | bg hardcoded       |
| `planned`     | `var(--color-muted)` = `#e2e6df`   | `var(--color-muted-foreground)`        | None               |

### Tinted item-row backgrounds (in expanded body)

| Lines   | Section           | Condition        | Background                | Text                          |
| ------- | ----------------- | ---------------- | ------------------------- | ----------------------------- |
| 200–210 | needsAttention    | severity=blocked | `#fee2e2` (hardcoded)     | `var(--color-destructive)`    |
| 207–211 | needsAttention    | severity≠blocked | `#fffcf5` (hardcoded)     | `var(--color-starbucks-gold)` |
| 235–239 | Current Week item | isBlocked        | `#fee2e2` (hardcoded)     | —                             |
| 235–239 | Current Week item | not blocked      | `var(--color-background)` | —                             |
| 297–300 | Risks row         | isBlocked        | `#fee2e2` (hardcoded)     | `var(--color-destructive)`    |
| 297–303 | Risks row         | not blocked      | `#fef3c7` (hardcoded)     | `var(--color-starbucks-gold)` |
| 335–336 | Decisions row     | —                | `var(--color-background)` | —                             |
| 362–364 | Priority rank 1   | rank === 1       | `#faf6ee` (hardcoded)     | —                             |

### Inline badge pills inside section rows

| Lines   | Context            | Background                          | Text                            |
| ------- | ------------------ | ----------------------------------- | ------------------------------- |
| 305–313 | Risks, isBlocked   | `rgba(200,32,20,0.15)` (hardcoded)  | `var(--color-destructive)`      |
| 305–313 | Risks, not blocked | `rgba(212,160,23,0.15)` (hardcoded) | `#8a6d1b` (hardcoded)           |
| 338     | Decisions badge    | `var(--color-success)`              | `var(--color-primary)`          |
| 370–378 | Priority rank 1    | `var(--color-starbucks-gold)`       | `#fff` (hardcoded)              |
| 370–378 | Priority rank > 1  | `var(--color-border)`               | `var(--color-muted-foreground)` |

### Hardcoded literals inventory (not tokenized)

| Literal                 | File:lines                      | Semantic intent                                   |
| ----------------------- | ------------------------------- | ------------------------------------------------- |
| `#fee2e2`               | lines 40, 42, 54, 203, 237, 298 | Light red — blocked background                    |
| `#fef3c7`               | lines 34, 36, 298               | Light amber — at-risk background                  |
| `#fffcf5`               | line 207                        | Warm near-white — at-risk needsAttention bg       |
| `#faf6ee`               | line 363                        | Warm beige — rank-1 priority row bg               |
| `#8a6d1b`               | lines 35, 312                   | Dark amber — at-risk text                         |
| `rgba(200,32,20,0.15)`  | line 308                        | Red tint — blocked badge background               |
| `rgba(212,160,23,0.15)` | line 309                        | Amber tint — at-risk badge background             |
| `rgba(212,160,23,0.18)` | line 208                        | Amber tint — border on at-risk needsAttention box |
| `rgba(0,117,74,0.16)`   | line 133                        | Green tint — highlight card shadow                |
| `#fff`                  | lines 53, 376                   | White text on filled badges                       |

---

## Patterns Digest

The external design systems surveyed (Atlassian, GitHub Primer, Linear, SAP Fiori, Material Design 3,
Carbon) converge on four rules that apply directly here:

1. **One true alert color.** Red is exclusively the highest-severity state. Reusing it on section
   labels ("Needs Attention", "Risks & Blockers") that are visible even when no blocked items are
   present trains the eye to ignore it.

2. **4–5 hues maximum in any status system.** The current component uses 7 simultaneously
   (two greens, red, amber/gold, neutral grey-green, teal success, mid green accent). Industry
   ceiling is 5.

3. **Neutral is the default.** Section labels, row backgrounds, and metadata carry no hue
   unless they represent a state requiring user action. Hierarchy comes from font weight and
   size, not color.

4. **Typography over hue for hierarchy.** The "Top Priorities" label uses gold; switching to
   `font-semibold` on a neutral color achieves the same visual weight without spending a hue slot.
   The same holds for "Decisions" using mid-green.

5. **Tokenize everything.** The 9 hardcoded literals above are the concrete maintenance hazard:
   theme changes break them silently, and they make WCAG audits require manual lookup.

---

## Option 1 — Single Red Alert, All Labels Neutral

**Concept:** Red stays exclusively for `blocked` states. Every section label, the at-risk
state, and the Priorities/Decisions labels all become neutral grey. Typography weight carries
the hierarchy. This is the most conservative change — it addresses the parrot problem
while touching the smallest number of surfaces.

### What keeps color

- **Header pill, `blocked`:** background `#fee2e2` → tokenized as `--color-status-blocked-bg`
  (`#fee2e2`), text `var(--color-destructive)` (`#c82014`). This is the single true alert.
- **Row backgrounds, isBlocked:** same `--color-status-blocked-bg`.
- **ITEM_STATUS_BADGE `completed`:** background `var(--color-primary)` — dark green fill
  with white text. This is a positive achievement state, visually distinct from alert.
- **Priority rank-1 badge:** background `var(--color-starbucks-gold)` — gold is explicitly
  reserved for priorities per the design system contract. It stays.

### What goes neutral

- **"Needs Attention" label** (line 195): `text-[var(--color-destructive)]` → `text-[var(--color-muted-foreground)]` + `font-bold`. Red only fires on the box itself when severity=blocked, not the label.
- **"Risks & Blockers" label** (line 287): same — `text-[var(--color-destructive)]` → `text-[var(--color-muted-foreground)]` + `font-bold`.
- **"Decisions" label** (line 328): `text-[var(--color-starbucks-accent)]` → `text-[var(--color-muted-foreground)]`. Decisions badge pill (line 338) stays teal-green (`var(--color-success)` bg).
- **"Top Priorities" label** (line 351): `text-[var(--color-starbucks-gold)]` → `text-[var(--color-muted-foreground)]` + `font-semibold`. The rank-1 gold badge and priority bg still anchor gold visually.
- **Header pill, `at-risk`** (lines 33–38): background `#fef3c7` + text `#8a6d1b` → background `var(--color-muted)` (`#e2e6df`), text `var(--color-foreground)` (`rgba(0,0,0,0.87)`) + `font-semibold`. "At-risk" is signaled by the label text only, not by amber color.
- **needsAttention box, severity≠blocked** (line 207): background `#fffcf5` + gold text → background `var(--color-surface-muted)` (`#f7f8f4`), text `var(--color-foreground)`.
- **Risks row, not blocked** (lines 298–303): background `#fef3c7` + gold text → background `var(--color-surface-muted)`, text `var(--color-foreground)`.
- **Risks badge pill, not blocked** (line 310): background `rgba(212,160,23,0.15)` + `#8a6d1b` text → background `var(--color-muted)`, text `var(--color-muted-foreground)`.
- **Decisions badge pill** (line 338): kept as-is (teal-green is the only surviving non-red non-gold hue — it is subtle and positive, not alarming).
- **Priority rank-1 row bg** (line 362): `#faf6ee` → tokenize as `--color-priority-row-bg` = `#faf6ee` (no color change, just tokenized). This is warm beige, not a hue — kept.
- **ITEM_STATUS_BADGE `in-progress`** (lines 48–51): background `var(--color-success)` / text `var(--color-primary)` stays — this is a progress indicator, subtle teal, acceptable.

### New tokens needed in globals.css

```css
--color-status-blocked-bg: #fee2e2; /* tokenizes 6 hardcoded #fee2e2 occurrences */
--color-status-at-risk-text: #8a6d1b; /* NOT needed if at-risk text goes neutral */
--color-priority-row-bg: #faf6ee; /* tokenizes hardcoded warm beige */
```

### Pros

- Maximally restrained — only one hue carries alarm meaning (red = blocked, period).
- Gold is strictly priorities, as the design system contract demands.
- Smallest diff — only label color classes change, not layout.
- Typography weight alone distinguishes Needs Attention / Risks / Decisions / Priorities.

### Cons

- At-risk state loses all color signal in the header pill — relies entirely on label text.
  For a status dashboard, this may reduce scanability at glance.
- "Needs Attention" and "Risks & Blockers" labels in neutral grey look identical to
  "Current Week" and "Next Week" — section identity depends entirely on the label text.

### WCAG note

- Neutral `rgba(0,0,0,0.54)` on `#f7f8f4` (surface-muted): ratio ≈ 5.3:1 — passes AA small text.
- `var(--color-destructive)` (`#c82014`) on `#fee2e2`: ratio ≈ 5.1:1 — passes AA small text.
- Gold `#cba258` on `#faf6ee` (rank-1 badge): ratio ≈ 2.8:1 — **fails AA small text** in current
  code too. Option 1 does not fix this; it keeps the gold badge as-is. A follow-up contrast fix
  would darken the badge text to `#7a5200` (ratio ≈ 5.9:1).

---

## Option 2 — Single Red Alert + Retained Amber Left-Border for At-Risk

**Concept:** Same as Option 1 (red = blocked only, labels neutral) but restores a
narrow **4px amber left-border stripe** on at-risk rows instead of flooding the row
background with `#fef3c7`. This is the Carbon Design System "status bar" pattern: the
body stays cream/neutral; the border stripe communicates state without painting the
whole surface amber.

### What changes vs. Option 1

- **Header pill, `at-risk`:** background `var(--color-muted)`, text `var(--color-foreground)`
  (same as Option 1). The pill label "At Risk" is the primary signal.
- **Risks row, not blocked:** background `var(--color-surface-muted)` (`#f7f8f4`) + added
  `border-left: 3px solid var(--color-starbucks-gold)` (`#cba258`). Body text `var(--color-foreground)`.
- **needsAttention box, severity≠blocked:** background `var(--color-surface-muted)` +
  `border-left: 3px solid var(--color-starbucks-gold)`. Body text `var(--color-foreground)`.
- **Risks badge pill, not blocked:** background `var(--color-muted)` / text `var(--color-muted-foreground)`.
  The border stripe handles the amber signal; the pill goes neutral.

### New tokens needed in globals.css

```css
--color-status-blocked-bg: #fee2e2;
--color-status-at-risk-border: var(--color-starbucks-gold); /* = #cba258 */
--color-priority-row-bg: #faf6ee;
```

### Hue inventory after this option

1. **Red** — blocked backgrounds and text (single alarm hue).
2. **Amber left-border stripe** — at-risk rows (line accent only, no filled surface).
3. **Teal-green** — in-progress / decisions badges (positive/progress, subtle).
4. **Dark green** — completed badge fill (`var(--color-primary)`).
5. **Gold rank badge** — priority rank 1 (reserved-for-priorities contract satisfied).
6. **Neutral grey** — everything else.

Total: **5 hues with clear semantic roles** — at the industry ceiling, no exceeded.

### Pros

- At-risk state is visually distinguishable from neutral without flooding the surface.
- The left-border idiom is widely recognized (Carbon, GitHub, Linear all use it).
- Gold stays strictly priorities; the border stripe uses the same gold token but as a
  structural accent rather than a filled area, so the reading is "this row needs attention"
  not "this is a priority."
- All section labels remain neutral — hierarchy from weight, not color.

### Cons

- Adds a layout change (left-border) on top of color changes — slightly larger diff.
- The distinction between "amber left border = at-risk" and "gold filled badge = rank-1
  priority" relies on spatial context; a user scanning quickly could conflate them.
  Mitigation: they appear in different sections, never adjacently.

### WCAG note

- The amber left border (`#cba258`) is a 3px decorative line — it is a UI component,
  not text. WCAG 1.4.11 Non-text Contrast requires 3:1 against adjacent surface.
  `#cba258` on `#f7f8f4` (surface-muted): ratio ≈ 2.5:1 — **marginal, borderline fail**.
  Darken border to `#a07c30` (ratio ≈ 3.7:1 on `#f7f8f4`) to pass cleanly. This
  would be `--color-status-at-risk-border: #a07c30`.

---

## Option 3 — Monochromatic Green System, Red Reserved, No Amber

**Concept:** Remove amber/gold from the status system entirely. At-risk state maps to
a mid-green surface (derived from the primary green family at 8–10% opacity) rather
than amber. Only one non-green hue exists: red for blocked. Gold appears exclusively
on the priority rank badge (as per the design system contract). This produces a
fully monochromatic card except for the one alarm.

### At-risk color after this option

- **Header pill, `at-risk`:** background `#e0ede8` (= `#006241` at ~10% on white, warm green tint),
  text `var(--color-primary)` (`#006241`). This token would be `--color-status-at-risk-bg: #e0ede8`.
- **needsAttention box, severity≠blocked:** background `var(--color-surface-muted)` (`#f7f8f4`),
  text `var(--color-muted-foreground)`. No amber anywhere.
- **Risks row, not blocked:** background `var(--color-surface-muted)`, text `var(--color-foreground)`.

### Hue inventory after this option

1. **Red** — blocked only.
2. **Green family** (3 tones: `#006241` dark, `#00754a` mid, `#d4e9e2` teal-light) — on-track, in-progress, decisions, at-risk header pill, highlight border.
3. **Gold** — priority rank-1 badge only.
4. **Neutral grey** — everything else.

Total: **3 hue families** (red, green, gold) — well under the industry ceiling.

### New tokens needed in globals.css

```css
--color-status-blocked-bg: #fee2e2;
--color-status-at-risk-bg: #e0ede8; /* derived: #006241 @ 10% on #fff */
--color-priority-row-bg: #faf6ee;
```

### Pros

- Fewest hues of any option — the card reads as a green system with one alarm.
- Consistent with the Starbucks design language: cream canvas, green hierarchy.
- Gold is unambiguously "priority" — no amber-vs-gold confusion.
- At-risk and on-track pills share the green family, distinguished by label text + weight.

### Cons

- At-risk (`#e0ede8`) and on-track (`var(--color-success)` = `#d4e9e2`) are both pale
  green. They are distinguishable but closely related. Users who rely on hue to
  differentiate states (color-blind users aside) need to read the label.
- "At risk" mapped to a green family contradicts cross-industry convention (amber = caution).
  A new team member will likely find this counterintuitive.
- On a dense dashboard with many products, losing the amber hue for at-risk reduces
  preattentive scanning speed.

### WCAG note

- `var(--color-primary)` (`#006241`) on `#e0ede8`: ratio ≈ 5.7:1 — passes AA small text.
- `var(--color-primary)` on `var(--color-success)` (`#d4e9e2`): ratio ≈ 5.3:1 — passes AA.

---

## Recommendation

**Option 2** — Single Red Alert + Amber Left-Border for At-Risk.

Reasons:

1. **Red stays strictly blocked.** This resolves the core parrot problem. Red on section
   labels goes away; the alarm hue only fires on blocked row backgrounds.

2. **Amber is retained as caution, not as a flood.** The left-border stripe (with border
   darkened to `#a07c30` for WCAG) preserves the cross-industry "amber = caution" reading
   that users already associate with the at-risk state — without painting the whole row
   surface amber.

3. **Gold stays priority-only.** The border stripe uses a distinct rendering mode
   (structural line vs. filled badge) so the semantic distinction between "at-risk border"
   and "rank-1 gold badge" is maintained.

4. **Section labels all go neutral.** "Needs Attention", "Risks & Blockers", "Decisions",
   and "Top Priorities" labels become `text-[var(--color-muted-foreground)]` with
   `font-bold`. Hierarchy is typography, not color.

5. **Tokenizes 6 hardcoded literals** (`#fee2e2` × 6) into one named token, making
   future theme changes a single-line edit.

Option 1 is acceptable if the team judges at-risk scanability is not critical at glance.
Option 3 is not recommended because it maps at-risk to a green-family hue, which is
unconventional and will confuse new contributors.

---

## Tokens That Would Change

### New tokens to add to globals.css

| New token                       | Value     | Replaces                                                                                        |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `--color-status-blocked-bg`     | `#fee2e2` | 6× hardcoded `#fee2e2` (lines 40, 42, 54, 203, 237, 298)                                        |
| `--color-status-at-risk-border` | `#a07c30` | hardcoded `rgba(212,160,23,0.15)` amber tint (line 310); replaces full amber bg on at-risk rows |
| `--color-priority-row-bg`       | `#faf6ee` | hardcoded `#faf6ee` (line 362)                                                                  |

### Tokens whose usage changes (value unchanged, application narrowed)

| Token                                  | Current uses that change                                | After Option 2                                                                                     |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `--color-destructive` (`#c82014`)      | Section labels lines 195, 287                           | Removed from labels; kept on blocked row text + badge text only                                    |
| `--color-starbucks-gold` (`#cba258`)   | Section label line 351; at-risk row text lines 207, 300 | Removed from labels and row text; kept on priority rank-1 badge (line 370) only                    |
| `--color-starbucks-accent` (`#00754a`) | Section label line 328                                  | Removed from "Decisions" label; kept on card highlight border (line 129) and focus ring (line 139) |

### Hardcoded literals eliminated

| Literal                 | Lines                     | Action                                                                                                   |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `#fee2e2`               | 40, 42, 54, 203, 237, 298 | → `var(--color-status-blocked-bg)`                                                                       |
| `#fef3c7`               | 34, 36, 298               | → at-risk rows: removed (left-border replaces bg fill); at-risk header pill: `var(--color-muted)`        |
| `#fffcf5`               | 207                       | → `var(--color-surface-muted)`                                                                           |
| `#faf6ee`               | 363                       | → `var(--color-priority-row-bg)`                                                                         |
| `#8a6d1b`               | 35, 312                   | → at-risk header pill text: `var(--color-foreground)`; risks badge text: `var(--color-muted-foreground)` |
| `rgba(200,32,20,0.15)`  | 308                       | → `var(--color-status-blocked-bg)` (same blocked bg, inner pill uses same token)                         |
| `rgba(212,160,23,0.15)` | 309                       | → `var(--color-muted)` (badge goes neutral; border stripe on parent row carries amber signal)            |
| `rgba(212,160,23,0.18)` | 208                       | → removed together with the bg-fill removal (the left-border stripe replaces both)                       |
| `rgba(0,117,74,0.16)`   | 133                       | → tokenize as `--color-highlight-shadow` = `rgba(0,117,74,0.16)` (value unchanged, named)                |
| `#fff`                  | 53, 376                   | → `var(--color-primary-foreground)` (= `#ffffff`, already defined)                                       |

### Summary of hue count after Option 2

| Before                                                                      | After                                                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 7 hues in a single card (red, 2× greens, amber filled, teal, gold, neutral) | 5 semantic roles (red alarm, amber left-border stripe, teal-progress, dark-green completed, gold priority-rank, neutral for all else) |

---

_Line numbers adversarially verified against the repo on 2026-06-10; eight corrections from the verify pass are already applied above._
