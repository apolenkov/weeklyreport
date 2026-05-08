import { TRPCError } from '@trpc/server';

import {
  ReportSectionAccessError,
  ReportSectionDomainError,
} from '../../modules/report-sections/report-sections.service.js';
import { ReviewAccessError } from '../../modules/review/review.service.js';
import { PublicationAccessError } from '../../modules/publication/publication.service.js';
import { AdminAccessError } from '../../modules/admin/admin.service.js';
import { PdfExportDomainError } from '../../modules/pdf-export/pdf-export.service.js';
import { ReminderDomainError } from '../../modules/reminders/reminders.service.js';
import { CarryOverDomainError } from '../../modules/carry-over/carry-over.service.js';
import { ArchiveDomainError } from '../../modules/archive/archive.service.js';
import { WeeklyReportDomainError } from '../../modules/weekly-report/weekly-report.service.js';
import {
  LeadFormAccessError,
  LeadFormDomainError,
} from '../../modules/report-sections/lead-form.service.js';

export function mapDomainError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof ReportSectionDomainError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error });
  }

  if (
    error instanceof ReviewAccessError ||
    error instanceof AdminAccessError ||
    error instanceof ReportSectionAccessError ||
    error instanceof LeadFormAccessError
  ) {
    return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
  }

  if (error instanceof PublicationAccessError) {
    return new TRPCError({ code: 'CONFLICT', message: error.message, cause: error });
  }

  if (error instanceof PdfExportDomainError || error instanceof ArchiveDomainError) {
    return new TRPCError({ code: 'NOT_FOUND', message: error.message, cause: error });
  }

  if (error instanceof WeeklyReportDomainError) {
    return new TRPCError({ code: 'NOT_FOUND', message: error.message, cause: error });
  }

  if (error instanceof LeadFormDomainError) {
    return new TRPCError({ code: 'NOT_FOUND', message: error.message, cause: error });
  }

  if (error instanceof ReminderDomainError || error instanceof CarryOverDomainError) {
    return new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error });
  }

  // Unknown error path: preserve `cause` so the loggingMiddleware can log
  // the underlying stack/constructor/message. Without this, every internal
  // bug surfaces as a contextless "Unexpected error" line and the actual
  // root cause is unrecoverable from the log stream.
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected error',
    cause: error instanceof Error ? error : undefined,
  });
}
