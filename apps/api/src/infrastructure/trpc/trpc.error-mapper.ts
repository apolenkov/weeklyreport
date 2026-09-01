import { TRPCError } from "@trpc/server";

import {
  AdminAccessError,
  AdminGroupProductConflictError,
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  AdminPeriodStaleStateError,
  AdminReopenRequestAlreadyProcessedError,
  AdminReopenRequestNotFoundError,
  AdminSnapshotConflictError,
  AdminUserActivityAssignmentConflictError,
  AdminUserConflictError,
  AdminUserPublishedHistoryError,
  AdminUserReportingGroupRequiredError,
} from "../../modules/admin/index.js";
import {
  AiPromptConfigurationError,
  AiPromptConflictError,
  AiPromptNotFoundError,
} from "../../modules/ai-prompts/index.js";
import {
  AiProviderConfigurationError,
  AiProviderNotFoundError,
  CredentialCodecError,
  ProviderUrlPolicyError,
} from "../../modules/ai-provider/index.js";
import { ArchiveDomainError } from "../../modules/archive/index.js";
import {
  CarryOverConflictError,
  CarryOverDomainError,
} from "../../modules/carry-over/index.js";
import { PdfExportDomainError } from "../../modules/pdf-export/index.js";
import {
  PeriodAccessError,
  PeriodLifecycleIntegrityError,
  PeriodNotFoundError,
  PeriodScopeError,
  PeriodStaleStateError,
} from "../../modules/period/index.js";
import {
  ProjectActivityConflictError,
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "../../modules/project-activity/index.js";
import { PublicationNotFoundError } from "../../modules/publication/index.js";
import {
  ReminderDomainError,
  ReminderScopeError,
} from "../../modules/reminders/index.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../../modules/report-sections/index.js";
import {
  ReportSectionAccessError,
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../../modules/report-sections/index.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
  ReviewVersionConflictError,
} from "../../modules/review/index.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/index.js";

// A domain error class, matched against the thrown error via `instanceof`.
type DomainErrorCtor = abstract new (...args: never[]) => Error;

// Table (not if-chain) for the complexity lint ceiling. Order is irrelevant:
// every class extends Error directly, so no thrown error can match two rows.
// Non-obvious codes carry an inline WHY.
export const DOMAIN_ERROR_CODES: readonly (readonly [
  DomainErrorCtor,
  TRPCError["code"],
])[] = [
  [AiProviderConfigurationError, "BAD_REQUEST"],
  [AiProviderNotFoundError, "NOT_FOUND"],
  [CredentialCodecError, "BAD_REQUEST"],
  [ProviderUrlPolicyError, "BAD_REQUEST"],
  [AiPromptConfigurationError, "BAD_REQUEST"],
  [AiPromptConflictError, "CONFLICT"],
  [AiPromptNotFoundError, "NOT_FOUND"],
  // A section-write version conflict is a concurrency clash, not a validation
  // failure — CONFLICT (409) so the client reloads and retries, distinct from
  // the ReportSectionDomainError BAD_REQUEST below.
  [SectionVersionConflictError, "CONFLICT"],
  // The report/section a write targets vanished inside the lock window — the
  // resource is gone, so NOT_FOUND, distinct from the period-state and
  // validation rejections that share ReportSectionDomainError's BAD_REQUEST.
  [ReportSectionNotFoundError, "NOT_FOUND"],
  [ReportSectionDomainError, "BAD_REQUEST"],
  [ReviewAccessError, "FORBIDDEN"],
  [ReviewNotFoundError, "NOT_FOUND"],
  [ReviewConstraintError, "BAD_REQUEST"],
  // A verdict's version lock lost to a concurrent lead re-submit — a
  // concurrency clash, not a validation failure: CONFLICT (409) so the client
  // reloads and re-decides, mirroring SectionVersionConflictError above.
  [ReviewVersionConflictError, "CONFLICT"],
  [AdminAccessError, "FORBIDDEN"],
  [ReportSectionAccessError, "FORBIDDEN"],
  [LeadFormAccessError, "FORBIDDEN"],
  [PdfExportDomainError, "NOT_FOUND"],
  [ArchiveDomainError, "NOT_FOUND"],
  [WeeklyReportDomainError, "NOT_FOUND"],
  [LeadFormDomainError, "NOT_FOUND"],
  // A lifecycle/one-pending block is a state conflict on an existing resource
  // → BAD_REQUEST, not NOT_FOUND.
  [ReopenRequestError, "BAD_REQUEST"],
  // Lead-form state-constraint (fill submitted/published section, revoke
  // non-submitted) — exists, so BAD_REQUEST not NOT_FOUND.
  [LeadFormConstraintError, "BAD_REQUEST"],
  // The carry-over dedupe race is a concurrency conflict, distinct from the
  // CarryOverDomainError validation failures below (which stay BAD_REQUEST).
  [CarryOverConflictError, "CONFLICT"],
  [ReminderDomainError, "BAD_REQUEST"],
  // Per-group scope rejection on a reminders namespace procedure (rule,
  // recipient, or lead out of the caller's group) → FORBIDDEN, mirroring
  // every other *AccessError/*ScopeError row in this table.
  [ReminderScopeError, "FORBIDDEN"],
  [CarryOverDomainError, "BAD_REQUEST"],
  // Manual period overlap is terminal (a retry re-overlaps) →
  // BAD_REQUEST, so the "already exists for these dates" toast flows verbatim.
  [AdminPeriodOverlapError, "BAD_REQUEST"],
  // Manual period edit on a missing reportId → NOT_FOUND (distinct
  // from the overlap BAD_REQUEST) so the admin UI shows a row-removed state.
  [AdminPeriodNotFoundError, "NOT_FOUND"],
  // A manual archive whose guarded compare-and-set lost to a concurrent writer
  // is a state conflict on an existing (already-archived) row → CONFLICT, not a
  // silent success.
  [AdminPeriodAlreadyArchivedError, "CONFLICT"],
  [AdminPeriodStaleStateError, "CONFLICT"],
  // A scoped re-load that finds no matching pending reopen request → NOT_FOUND.
  [AdminReopenRequestNotFoundError, "NOT_FOUND"],
  // The race-safe decide transaction's loser (zero rows matched the
  // compare-and-set) — a state conflict on an existing resource → CONFLICT.
  [AdminReopenRequestAlreadyProcessedError, "CONFLICT"],
  // A stale admin recovery snapshot conflicts with newer durable delivery
  // state; the operator must refresh instead of overwriting it.
  [AdminSnapshotConflictError, "CONFLICT"],
  // Scope/archived denial → FORBIDDEN; missing report → NOT_FOUND. Two
  // classes because they map to different codes.
  [PeriodScopeError, "FORBIDDEN"],
  [PeriodNotFoundError, "NOT_FOUND"],
  [PeriodStaleStateError, "CONFLICT"],
  // State/policy rejections on a lifecycle write are predictable, client-
  // recoverable failures on an existing resource — BAD_REQUEST, never internal.
  // The messages are fixed and safe to surface verbatim.
  [PeriodAccessError, "BAD_REQUEST"],
  // Corrupt persistence is an internal invariant failure. The error owns one
  // fixed safe message, so no stored tuple value reaches the client.
  [PeriodLifecycleIntegrityError, "INTERNAL_SERVER_ERROR"],
  [PublicationNotFoundError, "NOT_FOUND"],
  // Product owned by another group, terminal until the admin detaches it →
  // CONFLICT.
  [AdminGroupProductConflictError, "CONFLICT"],
  // An email or SAML identity collision is an existing-resource conflict.
  [AdminUserConflictError, "CONFLICT"],
  [AdminUserActivityAssignmentConflictError, "CONFLICT"],
  // Published reports retain their publisher identity; deactivation is the
  // supported offboarding path, so a hard delete is a state conflict.
  [AdminUserPublishedHistoryError, "CONFLICT"],
  // A non-viewer write without a reporting group is a validation failure on
  // the admin input — BAD_REQUEST, never a silently manufactured group.
  [AdminUserReportingGroupRequiredError, "BAD_REQUEST"],
  // Project Activity admin writes: a missing activity/group/product/lead is
  // NOT_FOUND; a business-rule violation (group mismatch, non-lead attach,
  // archived target) is BAD_REQUEST.
  [ProjectActivityNotFoundError, "NOT_FOUND"],
  [ProjectActivityDomainError, "BAD_REQUEST"],
  [ProjectActivityConflictError, "CONFLICT"],
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

  // Unknown error path: `cause` must survive so loggingMiddleware can recover
  // the underlying stack/constructor — without it every internal bug is a
  // contextless "Unexpected error". Must stay last and must not be tightened.
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
    cause: error instanceof Error ? error : undefined,
  });
}

export async function withDomainErrorMapping<T>(
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw mapDomainError(error);
  }
}
