type ReasonKind = "dev-only" | "external" | "needs-failure";

export interface Reason {
  kind: ReasonKind;
  why: string;
}

/**
 * Procedures that no run of the tester stand exercises, each with the specific reason. A procedure the
 * interface or the synthetic scenario (scripts/ui-crawl/scenario*.ts) calls successfully needs no entry.
 */
const FAILED_JOB =
  "acts on a failed queue job; the dead-letter queues are empty because every stand dependency (SMTP, Gotenberg, Redis) is healthy, and breaking one would fail the rest of the run";
const NEEDS_FAILURE = "needs-failure";
const DEV_MODE = "refuses unless AUTH_DEV_MODE=true";
const PROVIDER_REFUSAL =
  "refused with 400 unless a revision passed aiProvider.test; the scenario asks for it and expects the refusal, a success needs the outside provider";

export const PROCEDURE_REASONS: Readonly<Record<string, Reason>> = {
  "dev.listUsers": {
    kind: "dev-only",
    why: `${DEV_MODE}; the stand signs in through SAML with dev mode off, and only the dev role switcher calls it`,
  },
  "dev.runtimeTarget": {
    kind: "dev-only",
    why: `${DEV_MODE}; the dev role switcher reads it to name the runtime target`,
  },
  "dev.wipeAndReseed": {
    kind: "dev-only",
    why: `${DEV_MODE} and wipes the database; the stand is reset by reset.sh instead, under the destructive guard`,
  },
  "admin.aiProvider.test": {
    kind: "external",
    why: "sends the revision's credential to the provider's host as a connection test; the stand has no outbound approval and must not message the outside",
  },
  "admin.aiProvider.activate": {
    kind: "external",
    why: PROVIDER_REFUSAL,
  },
  "admin.aiProvider.restore": {
    kind: "external",
    why: PROVIDER_REFUSAL,
  },
  "admin.jobs.retryFailed": {
    kind: NEEDS_FAILURE,
    why: FAILED_JOB,
  },
  "admin.jobs.removeFailed": {
    kind: NEEDS_FAILURE,
    why: FAILED_JOB,
  },
  "admin.jobs.retryPdfRecovery": {
    kind: NEEDS_FAILURE,
    why: "acts on a quarantined PDF export; an export is quarantined only after repeated renderer failures, and Gotenberg on the stand is healthy",
  },
};
