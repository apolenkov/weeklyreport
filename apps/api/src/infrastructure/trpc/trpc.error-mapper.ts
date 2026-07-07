import { TRPCError } from "@trpc/server";

import {
  AdminAccessError,
  AdminGroupProductConflictError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
} from "../../modules/admin/admin.service.js";
import { ArchiveDomainError } from "../../modules/archive/archive.service.js";
import {
  CarryOverConflictError,
  CarryOverDomainError,
} from "../../modules/carry-over/carry-over.service.js";
import { PdfExportDomainError } from "../../modules/pdf-export/pdf-export.service.js";
import {
  PeriodNotFoundError,
  PeriodScopeError,
} from "../../modules/period/application/period.service.js";
import {
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "../../modules/project-activity/project-activity.service.js";
import {
  PublicationAccessError,
  PublicationArchivedError,
  PublicationNotFoundError,
} from "../../modules/publication/application/publication.service.js";
import { ReminderDomainError } from "../../modules/reminders/reminders.service.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../../modules/report-sections/application/lead-form.service.js";
import {
  ReportSectionAccessError,
  ReportSectionDomainError,
  SectionVersionConflictError,
} from "../../modules/report-sections/application/report-sections.service.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
} from "../../modules/review/application/review.service.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/weekly-report.service.js";

/** A domain error class, matched against the thrown error via `instanceof`. */
type DomainErrorCtor = abstract new (...args: never[]) => Error;

/**
 * Each domain error class → the tRPC status code it surfaces as. A table, not
 * an if-chain, because the `complexity` lint ceiling cannot accommodate one
 * `instanceof` branch per ~20 classes. Order is preserved from the prior
 * if-chain for readability, but correctness does NOT depend on it: every class
 * `extends Error` DIRECTLY (none extends another domain error), so no thrown
 * error can match two rows. The non-obvious codes — those that aren't the
 * "default" for their error shape — carry an inline WHY.
 */
const DOMAIN_ERROR_CODES: readonly (readonly [
  DomainErrorCtor,
  TRPCError["code"],
])[] = [
  // A section-write version conflict is a concurrency clash, not a validation
  // failure — CONFLICT (409) so the client reloads and retries, distinct from
  // the ReportSectionDomainError BAD_REQUEST below.
  [SectionVersionConflictError, "CONFLICT"],
  [ReportSectionDomainError, "BAD_REQUEST"],
  [ReviewAccessError, "FORBIDDEN"],
  [ReviewNotFoundError, "NOT_FOUND"],
  [ReviewConstraintError, "BAD_REQUEST"],
  [AdminAccessError, "FORBIDDEN"],
  [ReportSectionAccessError, "FORBIDDEN"],
  [LeadFormAccessError, "FORBIDDEN"],
  // An "already published / immutable" write is a state conflict, not a missing
  // resource — CONFLICT.
  [PublicationAccessError, "CONFLICT"],
  // Publishing a report archived inside the read→write window is an
  // authorization denial on the target, not a state conflict — FORBIDDEN,
  // mirroring PeriodScopeError on the period publish path.
  [PublicationArchivedError, "FORBIDDEN"],
  [PdfExportDomainError, "NOT_FOUND"],
  [ArchiveDomainError, "NOT_FOUND"],
  [WeeklyReportDomainError, "NOT_FOUND"],
  [LeadFormDomainError, "NOT_FOUND"],
  // reopen-request-lifecycle: a lifecycle/one-pending block is a state
  // conflict on an existing resource → BAD_REQUEST, not NOT_FOUND.
  [ReopenRequestError, "BAD_REQUEST"],
  // map-domain-errors: lead-form state-constraint (fill submitted/published
  // section, revoke non-submitted) — exists, so BAD_REQUEST not NOT_FOUND.
  [LeadFormConstraintError, "BAD_REQUEST"],
  // The carry-over dedupe race is a concurrency conflict, distinct from the
  // CarryOverDomainError validation failures below (which stay BAD_REQUEST).
  [CarryOverConflictError, "CONFLICT"],
  [ReminderDomainError, "BAD_REQUEST"],
  [CarryOverDomainError, "BAD_REQUEST"],
  // Manual period overlap is terminal (a retry re-overlaps) →
  // BAD_REQUEST, so the "already exists for these dates" toast flows verbatim.
  [AdminPeriodOverlapError, "BAD_REQUEST"],
  // Manual period edit on a missing reportId → NOT_FOUND (distinct
  // from the overlap BAD_REQUEST) so the admin UI shows a row-removed state.
  [AdminPeriodNotFoundError, "NOT_FOUND"],
  // An out-of-scope or archived period-lifecycle target is an authorization
  // denial → FORBIDDEN; a missing report → NOT_FOUND. Two classes because they
  // map to different codes. PeriodAccessError stays unmapped on purpose — its
  // state/policy 500s are a separate, deferred concern.
  [PeriodScopeError, "FORBIDDEN"],
  [PeriodNotFoundError, "NOT_FOUND"],
  // map-domain-errors: getAssembledReport on a missing report → NOT_FOUND.
  [PublicationNotFoundError, "NOT_FOUND"],
  // map-domain-errors: product owned by another group, terminal until the admin
  // detaches it → CONFLICT.
  [AdminGroupProductConflictError, "CONFLICT"],
  // Project Activity admin writes: a missing activity/group/product/lead is
  // NOT_FOUND; a business-rule violation (group mismatch, non-lead attach,
  // archived target) is BAD_REQUEST.
  [ProjectActivityNotFoundError, "NOT_FOUND"],
  [ProjectActivityDomainError, "BAD_REQUEST"],
];

export function mapDomainError(error: unknown): TRPCError {
  // Pass an already-typed tRPC error through unchanged.
  if (error instanceof TRPCError) {
    return error;
  }

  for (const [DomainError, code] of DOMAIN_ERROR_CODES) {
    if (error instanceof DomainError) {
      return new TRPCError({ code, message: error.message, cause: error });
    }
  }

  // Unknown error path: preserve `cause` so the loggingMiddleware can log the
  // underlying stack/constructor/message. Without this, every internal bug
  // surfaces as a contextless "Unexpected error" line and the root cause is
  // unrecoverable from the log stream. This fallback MUST stay last and MUST
  // NOT be tightened.
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
    cause: error instanceof Error ? error : undefined,
  });
}
