/** Evidence emitted only after the owned Playwright process group is gone. */
export type PreflightPlaywrightChildCleanupEvidence = Readonly<{
  readonly status: "PASS";
  readonly ownership: "OWNED";
  readonly processGroup: "GONE";
  readonly pid: number;
  readonly pgid: number;
}>;

export const preflightPlaywrightChildCleanupEvidenceFor = (
  ownership: Pick<PreflightPlaywrightChildCleanupEvidence, "pid" | "pgid">,
): PreflightPlaywrightChildCleanupEvidence => ({
  status: "PASS",
  ownership: "OWNED",
  processGroup: "GONE",
  pid: ownership.pid,
  pgid: ownership.pgid,
});

export const preflightPlaywrightChildCleanupWithOrdinalFor = (
  ownership: Pick<PreflightPlaywrightChildCleanupEvidence, "pid" | "pgid"> & {
    readonly childOrdinal: number;
  },
) => ({
  ...preflightPlaywrightChildCleanupEvidenceFor(ownership),
  childOrdinal: ownership.childOrdinal,
});

export type ObservePreflightPlaywrightChildCleanup = (
  evidence: PreflightPlaywrightChildCleanupEvidence,
) => void;
