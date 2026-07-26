/**
 * Domain error classes for the reminders module, split out of
 * `reminders.service.ts` so `reminders-scope.service.ts` can throw them
 * without a circular import back into the file that extends it.
 * `reminders.service.ts` re-exports both for existing consumers.
 */

export class ReminderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderDomainError";
  }
}

/**
 * Thrown by every reminders scope-assertion check
 * (`resolveExecutionsRecipientAllowlist` / `dispatchPendingReminders`).
 * Mapped to `FORBIDDEN` in `trpc.error-mapper.ts`; the message is the
 * caller-visible reason.
 */
export class ReminderScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderScopeError";
  }
}
