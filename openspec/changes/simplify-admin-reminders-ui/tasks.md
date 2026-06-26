# Tasks — simplify-admin-reminders-ui

## 1. Format & state helpers (`reminders-tab-format.ts`, `reminders-form-state.ts`)

- [ ] 1.1 Add a `ReminderPreset` model: two presets mapping to `(kind, audience)`
      — deadline→lead-with-draft, escalation→head-of-late — plus a `presetForPolicy`
      resolver that returns the preset or `"custom"` for non-preset pairings.
- [ ] 1.2 Add a plain-language recipient describer (preset/pair → English line)
      and reuse the existing offset→phrase formatter for "24h before deadline".
- [ ] 1.3 Add a `nextSend` selector: earliest future `fireAt` among a policy's
      derived rules → formatted date, else `null` (→ "No upcoming sends").
- [ ] 1.4 Extend `PolicyFormState` with the selected preset; keep `kind`/`audience`
      derived from it on save, and preserved verbatim for a `"custom"` row.

## 2. Card (`policy-row.tsx`)

- [ ] 2.1 Replace the jargon header with: on/off toggle (writes `active`), plain
      timing phrase, plain recipient line.
- [ ] 2.2 Remove the "Schedule"/"Hide schedule" expander and the
      `DerivedRulesPanel`; render the single next-send line instead.
- [ ] 2.3 Keep Edit / Remove; ensure the toggle uses the existing save mutation.
- [ ] 2.4 All copy English; no "policy" in user-facing strings.

## 3. Dialog (`policy-form.tsx`)

- [ ] 3.1 Replace the `Kind` + `Audience` dropdowns with one "Reminder type"
      preset selector (two options; `follow_up` not offered).
- [ ] 3.2 For a `"custom"` legacy row, show the type as a read-only "Custom"
      label and write back the original `kind`/`audience` unchanged.
- [ ] 3.3 Keep the numeric-amount + unit + before/after timing input unchanged.
- [ ] 3.4 Move timezone + `Valid from`/`Valid until`/forever into a
      default-collapsed "Advanced" section; keep the validity-range guard.

## 4. Wiring & tab shell copy (`reminders-tab.tsx`)

- [ ] 4.1 Stop threading derived rules into the row as an editable schedule;
      pass only what the next-send line needs.
- [ ] 4.2 Seed the form's preset from the policy on Edit; default new reminders to
      the deadline→leads preset. Do NOT blend `defaultReminderAudience` into the
      pairing (it must not produce `deadline` → `head-of-late`).
- [ ] 4.3 Rewrite tab-shell copy to "Reminder": title ("Reminder Policies" →
      "Reminders"), description, search placeholder + aria, the "New Policy" CTA,
      and the save/remove toasts ("Policy updated/created/removed").
- [ ] 4.4 Remove-confirm dialog: title "Remove reminder policy?" → "Remove
      reminder?"; preview uses the plain timing + recipient line, not
      `formatPolicyHeadline`.

## 5. Tests

- [ ] 5.1 Update `reminders-tab.test.tsx` + any `PolicyRow`/`PolicyForm` snapshots
      to the new copy, next-send line, and preset control.
- [ ] 5.2 Add a test: a legacy non-preset policy renders as "Custom" and keeps its
      stored `kind`/`audience` after editing only the timing.
- [ ] 5.3 Add a test: disabled / no-future-rule policy shows "No upcoming sends".
- [ ] 5.4 Add a test: tab title/CTA/search/toasts/remove-dialog render "Reminder"
      and never the word "policy".
- [ ] 5.5 Add a test: with org default audience `head-of-late`, opening Add and
      saving without touching the type persists a valid preset (never
      `deadline` → `head-of-late`).

## 6. Docs & gates

- [ ] 6.1 `CONTEXT.md` "Reminders & notifications" glossary section is present
      (Reminder / Reminder type / Reminder policy / Reminder rule). (done in this change)
- [ ] 6.2 `pnpm typecheck`, `pnpm lint`, `pnpm test` green; Cyrillic grep on changed
      `*.tsx` clean of production copy.
- [ ] 6.3 Live-verify on `/admin?tab=reminders` per design.md.
