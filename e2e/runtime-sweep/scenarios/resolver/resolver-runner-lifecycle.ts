export interface CanonicalReseedLifecycle {
  readonly reseed: () => Promise<void>;
}

export const runWithCanonicalReseed = async <T extends object>(
  run: (lifecycle: CanonicalReseedLifecycle) => Promise<T>,
  reseed: () => Promise<void>,
  finalize: (result: T) => Promise<T>,
): Promise<T> => {
  const state: {
    attempted: boolean;
    succeeded: boolean;
    failed: boolean;
    failure: unknown;
  } = {
    attempted: false,
    succeeded: false,
    failed: false,
    failure: undefined,
  };
  const reseedOnce = async (): Promise<void> => {
    if (state.attempted) {
      if (state.succeeded) return;
      throw state.failure;
    }
    state.attempted = true;
    try {
      await reseed();
      state.succeeded = true;
    } catch (error: unknown) {
      state.failed = true;
      state.failure = error;
      throw error;
    }
  };
  const outcome = await Promise.resolve()
    .then(() => run({ reseed: reseedOnce }))
    .then((result) => ({ ok: true as const, result }))
    .catch((error: unknown) => ({ ok: false as const, error }));
  if (!state.attempted) await reseedOnce();
  if (!outcome.ok) throw outcome.error;
  if (state.failed) throw state.failure;
  return finalize(outcome.result);
};
