## Why

Live page feedback on `/admin?tab=reminders`: the admin could not follow the
reminders logic. The current screen presents the engine's internals — a
ReminderPolicy template that "augments" into a read-only **Generated schedule**
table of derived rules, plus two independent `Kind` and `Audience` dropdowns and
a wall of timezone/validity fields. The admin's mental model is far simpler:
"a reminder I turn on or off and give a time." The gap between the two is the
confusion.

This change re-presents the existing reminders engine in the admin's language.
It is **UI-only**: the `ReminderPolicy` / `ReminderRule` schema, the
`PolicyApplicatorService` fan-out, and the hourly `@Cron` scheduler are
untouched. We keep every capability (offset-from-deadline timing, the
lead-vs-head split, escalation, validity windows) but stop making the admin read
the machinery.

## What Changes

- **Each policy renders as a plain-language Reminder card**, not an engine row.
  A card shows: an on/off toggle (the `active` flag), a human timing phrase
  ("24h before deadline"), and a one-line plain description of who is notified.
  The jargon header (`T-1440min · lead-with-draft`) is gone.
- **The read-only "Generated schedule" table and the "Schedule" expander are
  removed.** They are replaced by a single reassurance line —
  "Next send: <date>, then every period" — computed client-side from the derived
  rules already passed to the row. An inactive policy, or one with no upcoming
  rule, reads "No upcoming sends".
- **The Add/Edit dialog collapses the two `Kind` + `Audience` dropdowns into one
  "Reminder type" preset.** Only the two meaningful pairings are offered:
  "Deadline reminder to leads" (`kind=deadline`, `audience=lead-with-draft`) and
  "Escalation digest to head" (`kind=escalation`, `audience=head-of-late`). The
  unused `follow_up` kind is not offered. This also removes the current footgun
  where an admin can build a nonsensical pair (e.g. `deadline` → `head-of-late`).
- **The humane timing input stays as-is** (number + minutes/hours/days +
  before/after deadline) — it already matches the admin's "give it a time".
- **Timezone and the validity window (`Valid from` / `Valid until` / forever)
  move into a collapsed "Advanced" section** of the dialog, closed by default.
  They remain fully editable for the admin who needs dated rollout; they just
  stop cluttering the common path.
- **Copy uses the canonical term "Reminder", never "policy", across the whole
  tab** — not just the card and dialog. The tab title ("Reminder Policies"), the
  description, the search placeholder/aria, the "New Policy" CTA, the
  save/remove toasts ("Policy updated/created/removed"), and the remove-confirm
  dialog ("Remove reminder policy?") all currently say "policy" and are rewritten
  to "Reminder". The remove-confirm preview stops using the jargon headline
  (`formatPolicyHeadline` → raw `kind · T-offset · audience`) and shows the same
  plain timing + recipient line as the card. All copy stays English per the repo
  UI-strings rule.
- **Creating a new reminder always starts from a valid preset.** Today
  `emptyPolicyForm` hard-codes `kind=deadline` but takes `audience` from the
  org default, so a `head-of-late` default would silently build the invalid
  `deadline → head-of-late` pair — the exact footgun this change removes. The new
  reminder defaults to the "Deadline reminder to leads" preset; the stray
  `defaultReminderAudience` no longer leaks into an unpaired audience.
- **The list stays a general Add / Edit / Remove list** (parity with the engine,
  which still supports N policies and validity windows). The common case is two
  cards, so it still feels simple.

Out of scope: the `Settings → Reminders` defaults sub-tab is left as-is. Its
"Default audience" control becomes partly redundant once the preset implies the
audience; that cleanup is noted as a follow-up in `design.md`, not done here.

## Capabilities

- `admin-reminders-ui` (NEW) — the admin Reminders tab's presentation contract:
  plain-language Reminder cards, the next-send line in place of the generated
  schedule, and the preset-based Add/Edit dialog. The reminders ENGINE
  (scheduling, fan-out, dispatch) is not a capability touched here.

## Impact

- Web (in scope):
  - `apps/web/src/components/admin/policy-row.tsx` — card re-presentation; drop
    the Schedule expander + `DerivedRulesPanel`; add the next-send line.
  - `apps/web/src/components/admin/policy-form.tsx` — preset selector replaces
    Kind+Audience; Advanced section wraps timezone + validity.
  - `apps/web/src/components/admin/reminders-tab.tsx` — wire the preset and the
    Advanced state; remove derived-rules wiring from the row; rewrite the tab
    title, description, search placeholder/aria, the "New Policy" CTA, the
    save/remove toasts, and the remove-confirm dialog title + preview to say
    "Reminder"; default a new reminder to the deadline→leads preset.
  - `apps/web/src/components/admin/reminders-tab-format.ts` — preset ↔ (kind,
    audience) mapping, next-send formatting, plain recipient descriptions.
  - `apps/web/src/components/admin/reminders-form-state.ts` — preset field in the
    form state.
- Tests: `reminders-tab.test.tsx` and any snapshot for `PolicyRow` / `PolicyForm`
  update to the new copy, the next-send line, and the preset control.
- NOT touched: `prisma/schema.prisma` (ReminderPolicy/ReminderRule), the API
  (`reminder-admin.service.ts`, `policy-applicator.service.ts`,
  `reminders.scheduler.ts`), the shared Zod contracts, the `@Cron` tick, and the
  `Settings → Reminders` defaults sub-tab. No schema, no migration, no API change.
- Domain docs: `CONTEXT.md` gains a "Reminders & notifications" glossary section
  (Reminder / Reminder type / Reminder policy / Reminder rule).
