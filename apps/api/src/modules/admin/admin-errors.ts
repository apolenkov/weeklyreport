export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

// Overlapping [periodStart, periodEnd] range → BAD_REQUEST so the toast shows
// which existing period is in the way.
export class AdminPeriodOverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodOverlapError";
  }
}

// Unknown reportId → NOT_FOUND so the toast copies the message verbatim.
export class AdminPeriodNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodNotFoundError";
  }
}

// The guarded archive CAS matched zero rows — a concurrent writer archived or
// reopened the period in the window. State conflict → CONFLICT, fail-closed.
export class AdminPeriodAlreadyArchivedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodAlreadyArchivedError";
  }
}

export class AdminPeriodStaleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodStaleStateError";
  }
}

// Product already belongs to a different reporting group → CONFLICT; the
// message names the current owner so the admin can detach first.
export class AdminGroupProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGroupProductConflictError";
  }
}

// Existing email/SAML identity → CONFLICT (exists, not invalid).
export class AdminUserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserConflictError";
  }
}

// Non-viewer without a reportingGroupId → BAD_REQUEST; never manufacture a
// group silently.
export class AdminUserReportingGroupRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserReportingGroupRequiredError";
  }
}

// Scoped re-load found no row (unknown id or out of the deciding head's
// scope) → NOT_FOUND. An already-decided row continues into the CAS update.
export class AdminReopenRequestNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminReopenRequestNotFoundError";
  }
}

// The race-safe conditional update matched zero rows — a concurrent decider
// already resolved the request → CONFLICT.
export class AdminReopenRequestAlreadyProcessedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminReopenRequestAlreadyProcessedError";
  }
}
