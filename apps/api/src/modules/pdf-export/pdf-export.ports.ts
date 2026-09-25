import type {
  AssembledReport,
  PdfExportJob,
  PublishedReportSnapshot,
  UserSession,
} from "@customreport/shared";

import type { JobTraceContext } from "../../lib/job-trace-context.js";

export type PdfExportJobContext = JobTraceContext;

export interface PdfExportEnqueueInput {
  readonly reportId: string;
  readonly jobId: string;
  // Non-credential requester identity; the worker mints a short-lived render
  // token from it at execution time, never from a persisted credential.
  readonly requestedBy: string;
}

export interface PdfExportEnqueuer {
  readonly enqueue: (
    input: PdfExportEnqueueInput,
    context: PdfExportJobContext,
  ) => Promise<void>;
}

export interface PdfExportTelemetry {
  readonly captureJobContext: () => PdfExportJobContext;
  readonly recordRequest: (role: string) => void;
}

export const PDF_EXPORT_ENQUEUER = Symbol("PdfExportEnqueuer");
export const PDF_EXPORT_TELEMETRY = Symbol("PdfExportTelemetry");

export type PdfExportJobRecord = PdfExportJob & { requestedBy: string };

/** The non-credential identity every durable mutation binds against. */
export interface PdfExportJobIdentity {
  readonly jobId: string;
  readonly reportId: string;
  readonly requestedBy: string;
}

export interface PdfExportTerminalState extends PdfExportJobIdentity {
  readonly status: "completed" | "failed";
  readonly artifactUrl?: string;
  readonly checksum?: string;
  readonly error?: string;
}

// Queue-side operations the coordinated retry drives while the export row
// lock is held. `isFailed` must re-read live state — never a captured one.
export interface PdfExportRetryQueue {
  readonly isFailed: () => Promise<boolean>;
  readonly retry: () => Promise<void>;
}

export type PdfExportRetryOutcome =
  "retried" | "queue-not-failed" | "ineligible";

/** Writes valid only while the export row lock is held by the open transaction. */
export interface PdfExportLockedJobWrites {
  readonly markFailed: (error: string) => Promise<void>;
  readonly markCompleted: (
    artifactUrl: string,
    checksum: string,
  ) => Promise<PdfExportJob>;
  readonly reviveFailed: () => Promise<void>;
}

export interface PdfExportRepository {
  readonly getPublishedReportForExport: (
    reportId: string,
    session: UserSession,
  ) => Promise<AssembledReport | null>;
  // Requester identity is mandatory: a job without a requester is a caller
  // bug and must fail loud rather than be relabelled as a system actor.
  readonly createExportJob: (
    job: PdfExportJob,
    requestedBy: string,
    publicationSnapshot: AssembledReport,
  ) => Promise<PdfExportJob>;
  readonly getPublishedReportForJob: (
    jobId: string,
  ) => Promise<PublishedReportSnapshot | null>;
  readonly getExportJob: (jobId: string) => Promise<PdfExportJobRecord | null>;
  readonly saveExportJob: (job: PdfExportJob) => Promise<PdfExportJob>;
  readonly markExportFailed: (jobId: string, error: string) => Promise<void>;
  // The one per-export serialization lane. `run` executes with the row under
  // FOR UPDATE and receives only transaction-scoped writes, so every locked
  // Postgres write commits or rolls back together. Queue side effects inside
  // `run` cannot roll back — a lost Redis ack leaves the enqueue uncertain —
  // so callers order durable writes before the queue call.
  readonly runLockedExportJob: <T>(
    jobId: string,
    run: (
      job: PdfExportJobRecord | null,
      writes: PdfExportLockedJobWrites,
    ) => Promise<T>,
  ) => Promise<T>;
}
