import { TRPCError } from "@trpc/server";

import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
} from "../../modules/admin/admin.service.js";
import { ArchiveDomainError } from "../../modules/archive/archive.service.js";
import {
  CarryOverConflictError,
  CarryOverDomainError,
} from "../../modules/carry-over/carry-over.service.js";
import { PdfExportDomainError } from "../../modules/pdf-export/pdf-export.service.js";
import { PublicationAccessError } from "../../modules/publication/publication.service.js";
import { ReminderDomainError } from "../../modules/reminders/reminders.service.js";
import {
  LeadFormAccessError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../../modules/report-sections/lead-form.service.js";
import {
  ReportSectionAccessError,
  ReportSectionDomainError,
  SectionVersionConflictError,
} from "../../modules/report-sections/report-sections.service.js";
import { ReviewAccessError } from "../../modules/review/review.service.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/weekly-report.service.js";

export function mapDomainError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  // A section-write version conflict is a concurrency clash, not a validation
  // failure — surface it as CONFLICT (409) so the client reloads and retries,
  // distinct from the BAD_REQUEST below. Its own type keeps the two apart.
  if (error instanceof SectionVersionConflictError) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ReportSectionDomainError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof ReviewAccessError ||
    error instanceof AdminAccessError ||
    error instanceof ReportSectionAccessError ||
    error instanceof LeadFormAccessError
  ) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PublicationAccessError) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof PdfExportDomainError ||
    error instanceof ArchiveDomainError
  ) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof WeeklyReportDomainError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof LeadFormDomainError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  // reopen-request-lifecycle (D4): a lifecycle/one-pending block is a state
  // conflict, not a missing resource — surface it as BAD_REQUEST.
  if (error instanceof ReopenRequestError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  // The carry-over dedupe race is a concurrency conflict, distinct from the
  // CarryOverDomainError validation/precondition failures below (which stay
  // BAD_REQUEST). It travels on its own type so this CONFLICT mapping does not
  // touch those.
  if (error instanceof CarryOverConflictError) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof ReminderDomainError ||
    error instanceof CarryOverDomainError
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  // UFB-063: manual period overlap surfaces as BAD_REQUEST so the toast
  // copy ("period already exists for these dates") flows straight to the
  // admin without any extra translation layer.
  if (error instanceof AdminPeriodOverlapError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  // UFB-067: manual period edit on a missing reportId. Distinct from the
  // overlap path (which is BAD_REQUEST) — surface as NOT_FOUND so the
  // admin UI can render a row-removed style empty state rather than a
  // generic validation error.
  if (error instanceof AdminPeriodNotFoundError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  // Unknown error path: preserve `cause` so the loggingMiddleware can log
  // the underlying stack/constructor/message. Without this, every internal
  // bug surfaces as a contextless "Unexpected error" line and the actual
  // root cause is unrecoverable from the log stream.
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
    cause: error instanceof Error ? error : undefined,
  });
}
