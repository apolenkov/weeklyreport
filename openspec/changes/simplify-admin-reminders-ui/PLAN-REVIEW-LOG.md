# Plan Review Log: simplify-admin-reminders-ui

Act 1 (grill-with-docs) complete — plan locked, CONTEXT.md glossary updated.
MAX_ROUNDS=5.

Locked decisions:

- UI-only; reminders engine untouched.
- General Add/Edit/Remove list, plain-language cards.
- Card: on/off + human timing + recipient line; generated-schedule table replaced
  by one next-send line.
- Dialog: single Reminder-type preset (kind×audience), timing input kept, timezone
  - validity under collapsed Advanced.
- Legacy non-preset pairings shown as read-only "Custom" and preserved.
- Scope: only the admin Reminders tab; Settings → Reminders defaults out of scope.

Act-1 Codex consults: unavailable (thread started, empty output — corp-proxy hang
hazard). Non-gating per skill; interview proceeded without them.

## Round 1 — Codex (VERDICT: REVISE)

1. New-reminder default path can still build the invalid `deadline → head-of-late`
   pair: `emptyPolicyForm` fixes `kind=deadline` but takes `audience` from the org
   default. Fix: default a new reminder to a complete preset; ignore stray default
   audience.
2. Remove-confirm dialog still shows engine jargon: "Remove reminder policy?" +
   `formatPolicyHeadline` (raw kind·offset·audience). Fix: "Remove reminder?" +
   plain timing/recipient preview.
3. Tab shell copy still says "policy": title, description, search, CTA, save/remove
   toasts. Fix: rewrite shell copy to "Reminder"; cover it in spec + tasks.

### Claude's response

All three accepted (verified against code — confirmed real). proposal.md "What
Changes"/Impact extended; spec R1 gains a whole-tab copy scenario and a
remove-preview clause; R3 gains a "new reminder never starts invalid" scenario;
design.md D6 broadened + new D7 (valid-preset default); tasks 4.2–4.4, 5.4, 5.5
added. Scope stays UI-only; engine untouched.

## Round 2 — Codex (VERDICT: REVISE)

Prior 3 findings all confirmed addressed across proposal/spec/design/tasks.
New (minor consistency): design.md follow-up still said "Default audience
preselects the audience on the New-policy form", contradicting D7 (now inert).

### Claude's response

Accepted. Reworded the follow-up: the Default-audience control no longer affects
Reminder type after D7 (inert, stays visible), removal is a separate change. No
scope change.

## Round 3 — Codex (VERDICT: APPROVED)

No remaining flaws. Consistency fix confirmed; `validate --strict` passes.
Converged after 3 rounds.
