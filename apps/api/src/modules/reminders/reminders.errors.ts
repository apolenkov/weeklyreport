// Domain error classes split out of `reminders.service.ts` so the scope
// service can throw them without a circular import; reminders.service.ts
// re-exports both for existing consumers.

export class ReminderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderDomainError";
  }
}

// Thrown by every reminders scope-assertion check. Mapped to FORBIDDEN in
// trpc.error-mapper.ts; the message is the caller-visible reason.
export class ReminderScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReminderScopeError";
  }
}

// Internal control-flow signal: the rule/report stopped being eligible between
// discovery and the atomic execution insert. Services turn it into a skipped
// dispatch; it must never escape to tRPC or enqueue a job.
export class ReminderExecutionIneligibleError extends Error {
  constructor() {
    super("Reminder execution requires an editable report and active rule.");
    this.name = "ReminderExecutionIneligibleError";
  }
}
