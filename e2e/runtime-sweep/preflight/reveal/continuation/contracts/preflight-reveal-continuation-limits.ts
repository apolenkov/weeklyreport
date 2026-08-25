export const REVEAL_CONTINUATION_LIMITS = {
  softWallMs: 60_000,
  yieldReserveMs: 10_000,
  maxTerminalCandidates: 256,
  maxRevealActionDelta: 1024,
  hardWallMs: 90_000,
  killGraceMs: 10_000,
} as const;

export type RevealContinuationCooperativeLimits = Readonly<{
  readonly maxTerminalCandidates: number;
  readonly maxRevealActionDelta: number;
}>;

const LIMIT_ENVIRONMENT = {
  softWallMs: "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_CHUNK_MS",
  yieldReserveMs:
    "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_YIELD_RESERVE_MS",
  maxTerminalCandidates:
    "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_MAX_TERMINAL_CANDIDATES",
  maxRevealActionDelta:
    "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_MAX_REVEAL_ACTION_DELTA",
  hardWallMs: "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_HARD_WALL_MS",
  killGraceMs: "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_KILL_GRACE_MS",
} as const;

export const revealContinuationLimitsFromEnvironment = (
  environment: NodeJS.ProcessEnv,
): typeof REVEAL_CONTINUATION_LIMITS => {
  for (const [name, environmentName] of Object.entries(LIMIT_ENVIRONMENT)) {
    const expected = String(
      REVEAL_CONTINUATION_LIMITS[
        name as keyof typeof REVEAL_CONTINUATION_LIMITS
      ],
    );
    const actual = environment[environmentName]?.trim();
    if (actual !== undefined && actual !== expected)
      throw new Error(`${environmentName} must equal source-bound ${expected}`);
  }
  return REVEAL_CONTINUATION_LIMITS;
};

export const revealContinuationLimitEnvironment = (
  limits: typeof REVEAL_CONTINUATION_LIMITS,
): NodeJS.ProcessEnv => ({
  [LIMIT_ENVIRONMENT.softWallMs]: String(limits.softWallMs),
  [LIMIT_ENVIRONMENT.yieldReserveMs]: String(limits.yieldReserveMs),
  [LIMIT_ENVIRONMENT.maxTerminalCandidates]: String(
    limits.maxTerminalCandidates,
  ),
  [LIMIT_ENVIRONMENT.maxRevealActionDelta]: String(limits.maxRevealActionDelta),
  [LIMIT_ENVIRONMENT.hardWallMs]: String(limits.hardWallMs),
  [LIMIT_ENVIRONMENT.killGraceMs]: String(limits.killGraceMs),
});

export const assertCooperativeRevealContinuationLimits = (
  limits: RevealContinuationCooperativeLimits | undefined,
): void => {
  if (limits === undefined) return;
  if (
    !Number.isSafeInteger(limits.maxTerminalCandidates) ||
    limits.maxTerminalCandidates < 1 ||
    limits.maxTerminalCandidates >
      REVEAL_CONTINUATION_LIMITS.maxTerminalCandidates ||
    !Number.isSafeInteger(limits.maxRevealActionDelta) ||
    limits.maxRevealActionDelta < 1 ||
    limits.maxRevealActionDelta >
      REVEAL_CONTINUATION_LIMITS.maxRevealActionDelta
  )
    throw new Error("Reveal continuation cooperative limits are invalid");
};
