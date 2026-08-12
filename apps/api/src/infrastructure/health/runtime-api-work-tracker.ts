const DEFAULT_DRAIN_TIMEOUT_MS = 5000;

export class RuntimeApiDrainTimeoutError extends Error {
  constructor() {
    super("Runtime API work did not drain before the deadline");
    this.name = "RuntimeApiDrainTimeoutError";
  }
}

type IdleWaiter = Readonly<{
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}>;

/** Tracks product API work until the underlying operation settles. */
export class RuntimeApiWorkTracker {
  private active = 0;
  private readonly idleWaiters = new Set<IdleWaiter>();

  async track<T>(operation: () => Promise<T>): Promise<T> {
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      if (this.active === 0) this.resolveIdleWaiters();
    }
  }

  async awaitIdle(timeoutMs = DEFAULT_DRAIN_TIMEOUT_MS): Promise<void> {
    if (this.active === 0) return;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new RuntimeApiDrainTimeoutError();

    await new Promise<void>((resolve, reject) => {
      const waiter: IdleWaiter = {
        resolve,
        timer: setTimeout(() => {
          this.idleWaiters.delete(waiter);
          reject(new RuntimeApiDrainTimeoutError());
        }, timeoutMs),
      };
      this.idleWaiters.add(waiter);
    });
  }

  activeCount(): number {
    return this.active;
  }

  private resolveIdleWaiters(): void {
    for (const waiter of this.idleWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    this.idleWaiters.clear();
  }
}

export const runtimeApiWorkTracker = new RuntimeApiWorkTracker();
