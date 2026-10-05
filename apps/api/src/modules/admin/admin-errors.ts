export {
  AdminGroupProductConflictError,
  AdminUserActivityAssignmentConflictError,
} from "../../lib/user-activity-assignment.js";

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

// Additive recovery never overwrites a newer or incompatible reminder state.
// The operator must export a fresh snapshot or resolve the live conflict.
export class AdminSnapshotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSnapshotConflictError";
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

// Existing identity or references prevent the requested user change → CONFLICT.
export class AdminUserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserConflictError";
  }
}

// Targeted activate/deactivate on an absent user id (P2025) → NOT_FOUND.
export class AdminUserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserNotFoundError";
  }
}

// Published history owns its publisher identity permanently. Administrators
// can deactivate the account, but hard deletion would invalidate the frozen
// snapshot metadata and is therefore an existing-resource conflict.
export class AdminUserPublishedHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserPublishedHistoryError";
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

// An administrator tried to deactivate, delete, or demote their own account →
// BAD_REQUEST; the message is fixed and safe to surface verbatim.
export class AdminSelfLockoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSelfLockoutError";
  }
}

// The write would leave the project without an active administrator → CONFLICT.
export class AdminLastAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminLastAdminError";
  }
}
