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
  // The durable row's generation being dispatched; the queue job id and the
  // worker's pre-render gate are both bound to it.
  readonly generation: number;
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
export const PDF_RENDERER = Symbol("PdfRenderer");

// Gotenberg's cookies form field keys the cookie jar by domain.
export interface PdfRenderCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly httpOnly: boolean;
  readonly sameSite: "Lax" | "Strict" | "None";
}

export interface PdfRenderRequest {
  readonly url: string;
  readonly cookies: readonly PdfRenderCookie[];
  readonly traceId: string;
}

export interface PdfRenderer {
  readonly render: (input: PdfRenderRequest) => Promise<Buffer>;
}

export type PdfExportJobRecord = PdfExportJob & { requestedBy: string };

/** The non-credential identity every durable mutation binds against. */
export interface PdfExportJobIdentity {
  readonly jobId: string;
  readonly reportId: string;
  readonly requestedBy: string;
  readonly generation: number;
}

export interface PdfExportTerminalState extends PdfExportJobIdentity {
  readonly status: "completed" | "failed";
  readonly artifactUrl?: string;
  readonly checksum?: string;
  readonly error?: string;
}

// Every manual retry binds to one durable generation transition: `retried`
// committed `pending(g+1)` (phase-B dispatch may be preempted by concurrent
// quarantine), `already-advanced` is the idempotent repeat of a stale
// expectedGeneration, and `ineligible` wrote nothing.
export type PdfExportRetryOutcome =
  "retried" | "already-advanced" | "ineligible";

/** Writes valid only while the export row lock is held by the open transaction. */
export interface PdfExportLockedJobWrites {
  // Terminal writes name the generation they claim: the CAS is
  // `status='pending' AND generation=g`, so a stale generation can never
  // touch the current row.
  readonly markFailed: (generation: number, error: string) => Promise<void>;
  readonly markCompleted: (
    generation: number,
    artifactUrl: string,
    checksum: string,
  ) => Promise<PdfExportJob>;
  // Orphan-scan quarantine: pending(g) → recovery_required(g).
  readonly markRecoveryRequired: (generation: number) => Promise<void>;
  // Head retry transition: failed|recovery_required(g) → pending(g+1),
  // clearing the terminal artifact fields.
  readonly advanceGeneration: (expectedGeneration: number) => Promise<void>;
}

/** Keyset cursor over the immutable `(createdAt, id)` pending-row ordering. */
export interface PdfExportPendingCursor {
  readonly createdAt: Date;
  readonly jobId: string;
}

/** The orphan scan's per-candidate projection — identity, generation, age. */
export interface PdfExportPendingCandidate {
  readonly jobId: string;
  readonly generation: number;
  readonly createdAt: Date;
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
  readonly markExportFailed: (
    jobId: string,
    generation: number,
    error: string,
  ) => Promise<void>;
  // Aged `pending` rows for the orphan scan: `createdAt <= bound`, keyset
  // `(createdAt, id)` past `cursor`, at most `limit` rows. `bound` is captured
  // once per pass so rows created during the pass are never chased.
  readonly listPendingExportCandidates: (
    bound: Date,
    cursor: PdfExportPendingCursor | null,
    limit: number,
  ) => Promise<PdfExportPendingCandidate[]>;
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
