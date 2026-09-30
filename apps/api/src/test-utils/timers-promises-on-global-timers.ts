// vi.useFakeTimers() does not patch node:timers/promises; this stand-in waits
// on the global setTimeout (which fake timers do patch) and keeps abort
// semantics, so retry backoff can be driven with advanceTimersByTimeAsync.
function setTimeout<T>(
  ms: number,
  value?: T,
  options?: { readonly signal?: AbortSignal | undefined },
): Promise<T | undefined> {
  const signal = options?.signal;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      globalThis.clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export const timersPromisesOnGlobalTimers = {
  default: { setTimeout },
  setTimeout,
};
