export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

/**
 * Thrown by `createPeriodManual` when the requested
 * [periodStart, periodEnd] range overlaps any existing Report. Mapped to
 * `BAD_REQUEST` by `mapDomainError` so the web layer can pipe the message
 * straight to a toast and the admin sees which existing period is in the
 * way.
 */
export class AdminPeriodOverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodOverlapError";
  }
}

/**
 * Thrown by `updatePeriodManual` when the supplied `reportId`
 * does not resolve to an existing Report. Maps to `NOT_FOUND` via the
 * trpc error-mapper so the web layer's toast can copy the message
 * verbatim ("Period <id> not found").
 */
export class AdminPeriodNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodNotFoundError";
  }
}

/**
 * Thrown by the guarded manual `archivePeriod` when its
 * `{ id, archived: false, periodStatus: "published" }` compare-and-set matches
 * zero rows — a concurrent writer archived or reopened the period inside the
 * read→write window. A state conflict on an existing resource (the row moved
 * off archivable-published, not missing), so the tRPC error-mapper renders it
 * CONFLICT. Fail-closed: the manual archive write is no longer unconditional,
 * so a reopen racing an archive is mutually exclusive from the archive side too.
 */
export class AdminPeriodAlreadyArchivedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPeriodAlreadyArchivedError";
  }
}

/**
 * Thrown by `attachProductToGroup` when the product already belongs to a
 * DIFFERENT reporting group. A state conflict (the product exists and is owned
 * elsewhere), so the tRPC error-mapper renders it CONFLICT; the message names
 * the current owner group so the admin can detach before re-attaching.
 */
export class AdminGroupProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGroupProductConflictError";
  }
}

/**
 * Thrown when user creation collides with an existing email or SAML identity.
 * The identity already exists, so the tRPC error-mapper renders the collision
 * as CONFLICT rather than treating it as a validation failure.
 */
export class AdminUserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserConflictError";
  }
}

/**
 * Thrown by `respondReopenRequest` when the scoped re-load finds no row —
 * unknown id, or a group outside the deciding head's scope (admin scope is
 * global, so this path is head-only in practice). Status is not filtered
 * here: an already-decided in-scope row continues into the CAS update and
 * yields already-processed instead. Maps to NOT_FOUND.
 */
export class AdminReopenRequestNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminReopenRequestNotFoundError";
  }
}

/**
 * Thrown by `respondReopenRequest` when the race-safe conditional update
 * matches zero rows — a concurrent decider (head + admin can both act) already
 * resolved the request. A state conflict on an existing resource, so the
 * tRPC error-mapper renders it CONFLICT.
 */
export class AdminReopenRequestAlreadyProcessedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminReopenRequestAlreadyProcessedError";
  }
}
