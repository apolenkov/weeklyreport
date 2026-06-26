# Tasks — simplify-admin-reminders-ui

## 1. Format & state helpers (`reminders-tab-format.ts`, `reminders-form-state.ts`)

- [x] 1.1 Add a `ReminderPreset` model: two presets mapping to `(kind, audience)`
      — deadline→lead-with-draft, escalation→head-of-late — plus a `presetForPolicy`
      resolver that returns the preset or `"custom"` for non-preset pairings.
- [x] 1.2 Add a plain-language recipient describer (preset/pair → English line)
      and reuse the existing offset→phrase formatter for "24h before deadline".
- [x] 1.3 Add a `nextSend` selector: earliest future `fireAt` among a policy's
      derived rules → formatted date, else `null` (→ "No upcoming sends").
- [x] 1.4 Extend `PolicyFormState` with the selected preset; keep `kind`/`audience`
      derived from it on save, and preserved verbatim for a `"custom"` row.

## 2. Card (`policy-row.tsx`)

- [x] 2.1 Replace the jargon header with: on/off toggle (writes `active`), plain
      timing phrase, plain recipient line.
- [x] 2.2 Remove the "Schedule"/"Hide schedule" expander and the
      `DerivedRulesPanel`; render the single next-send line instead.
- [x] 2.3 Keep Edit / Remove; ensure the toggle uses the existing save mutation.
- [x] 2.4 All copy English; no "policy" in user-facing strings.

## 3. Form (`policy-form.tsx`)

- [x] 3.1 Replace the `Kind` + `Audience` dropdowns with one "Reminder type"
      preset selector (two options; `follow_up` not offered).
- [x] 3.2 For a `"custom"` legacy row, show the type as a read-only "Custom"
      label and write back the original `kind`/`audience` unchanged.
- [x] 3.3 Keep the numeric-amount + unit + before/after timing input unchanged.
- [x] 3.4 Move timezone + `Valid from`/`Valid until`/forever into a
      default-collapsed "Advanced" section; keep the validity-range guard.

## 4. Wiring & tab shell copy (`reminders-tab.tsx`)

- [x] 4.1 Stop threading derived rules into the row as an editable schedule;
      pass only what the next-send line needs.
- [x] 4.2 Seed the form's preset from the policy on Edit; default new reminders to
      the deadline→leads preset. Do NOT blend `defaultReminderAudience` into the
      pairing (it must not produce `deadline` → `head-of-late`).
- [x] 4.3 Rewrite tab-shell copy to "Reminder": title ("Reminder Policies" →
      "Reminders"), description, search placeholder + aria, the "New Policy" CTA,
      and the save/remove toasts ("Policy updated/created/removed").
- [x] 4.4 Inline editing: clicking Edit replaces the card with the form in place;
      adding a new reminder renders the form at the top of the list.
- [x] 4.5 Remove-confirm dialog: title "Remove reminder policy?" → "Delete
      reminder?"; preview uses the plain timing + recipient line, not
      `formatPolicyHeadline`; warn that deletion is permanent and irreversible.

## 5. Backend hard-delete (`apps/api/src/modules/admin`)

- [x] 5.1 Rename `archiveReminderPolicy` → `deleteReminderPolicy` in the repository
      interface, Prisma repository, queries, and service.
- [x] 5.2 Implement hard-delete: delete the policy's `ReminderRule` rows first, then
      delete the `ReminderPolicy`. `ReminderExecution` rows cascade with their rules.
- [x] 5.3 Update `admin.integration.test.ts` to assert the policy and its rules are
      gone after deletion.
- [x] 5.4 Keep the existing `saveReminderPolicy` active-flag cascade to derived rules
      unchanged (still used for toggling on/off).

## 6. Tests

- [x] 6.1 Update `reminders-tab.test.tsx` + any `PolicyRow`/`PolicyForm` snapshots
      to the new copy, next-send line, and preset control.
- [x] 6.2 Add a test: a legacy non-preset policy renders as "Custom" and keeps its
      stored `kind`/`audience` after editing only the timing.
- [x] 6.3 Add a test: disabled / no-future-rule policy shows "No upcoming sends".
- [x] 6.4 Add a test: tab title/CTA/search/toasts/remove-dialog render "Reminder"
      and never the word "policy".
- [x] 6.5 Add a test: with org default audience `head-of-late`, opening Add and
      saving without touching the type persists a valid preset (never
      `deadline` → `head-of-late`).
- [x] 6.6 Update remove-confirm test to assert permanent-delete warning and the
      `removePolicy` mutation call.

## 7. Docs & gates

- [x] 7.1 `CONTEXT.md` "Reminders & notifications" glossary section is present
      (Reminder / Reminder type / Reminder policy / Reminder rule).
- [x] 7.2 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` green; Cyrillic
      grep on changed `*.tsx` clean of production copy.
- [x] 7.3 Live-verify on `/admin?tab=reminders`: cards, inline edit, next-send line,
      preset dialog, Advanced collapse, and permanent-delete flow.
