## ADDED Requirements

### Requirement: One dedupe-key shape across manual and automated dispatch

Every caller of `requestReminderExecution` for the `deadline` reminder kind MUST derive its dedupe key from the same builder, keyed by `{ ruleId, cycleDate, recipientEmail }` where `cycleDate` is the UTC `YYYY-MM-DD` truncation of the rule's `fireAt`.

This applies equally to the scheduler's automated tick (`RemindersScheduler.dispatchRule`) and the head-triggered manual dispatch (`RemindersScopeService.dispatchDraftSections`, reached via `reminders.dispatchPending`). Neither caller may build its own independent key shape for the same rule/recipient/cycle.

#### Scenario: Manual Remind after the automated reminder already fired

- **GIVEN** a reminder rule has already dispatched its automated deadline
  reminder to a lead for today's cycle
- **WHEN** a head triggers a manual `Remind` (`dispatchPendingReminders`)
  for that same rule and lead within the same cycle
- **THEN** no new `ReminderExecution` row is inserted and no second email is
  sent
- **AND** the response's `alreadySent` count includes that lead, not
  `dispatched`

#### Scenario: Manual Remind before any automated reminder has fired

- **GIVEN** a reminder rule has not yet dispatched any reminder to a lead
  for the current cycle
- **WHEN** a head triggers a manual `Remind` for that rule and lead
- **THEN** exactly one `ReminderExecution` row is inserted and one email is
  sent
- **AND** a subsequent automated scheduler tick for the same rule/lead/cycle
  deduplicates against it instead of sending a second email

#### Scenario: The dedupe key is internally consistent within one dispatch

- **GIVEN** `RemindersScopeService.dispatchDraftSections` processes a draft
  section during a manual dispatch
- **WHEN** it computes its own local key for the race-safe read-back and
  calls `requestReminderExecution` for the same rule/recipient
- **THEN** the locally computed key and the key `requestReminderExecution`
  builds internally are byte-identical
