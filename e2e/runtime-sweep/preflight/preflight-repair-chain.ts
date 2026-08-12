/**
 * Runs the only supported repair continuation. The full preflight is part of
 * the same launcher process that observed and validated the canary result.
 */
export async function runPreflightRepairChain<T>(input: {
  readonly runCanary: () => Promise<number>;
  readonly readCanary: () => Promise<T>;
  readonly assertCanary: (canary: T) => void;
  readonly recheckSource: () => Promise<void>;
  readonly runFull: () => Promise<number>;
}): Promise<number> {
  const canaryExit = await input.runCanary();
  if (canaryExit !== 0) return canaryExit;
  const canary = await input.readCanary();
  input.assertCanary(canary);
  await input.recheckSource();
  return input.runFull();
}
