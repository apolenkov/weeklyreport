/** Evidence emitted only after the owned Playwright process group is gone. */
export type PreflightPlaywrightChildCleanupEvidence = Readonly<{
  readonly status: "PASS";
  readonly ownership: "OWNED";
  readonly processGroup: "GONE";
  readonly pid: number;
  readonly pgid: number;
}>;

export type ObservePreflightPlaywrightChildCleanup = (
  evidence: PreflightPlaywrightChildCleanupEvidence,
) => void;
