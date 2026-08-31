export interface SessionTransitionHandle {
  readonly finish: () => void;
}

const transitionState: { activeToken: symbol | null } = { activeToken: null };
const completionListeners = new Set<() => void>();

// Only one session boundary may be crossed at a time. The handle owns the
// transition, so a stale failure cannot release a newer navigation attempt.
export function beginSessionTransition(): SessionTransitionHandle | null {
  if (transitionState.activeToken !== null) return null;

  const token = Symbol("session-transition");
  transitionState.activeToken = token;

  return {
    finish: () => {
      if (transitionState.activeToken !== token) return;
      transitionState.activeToken = null;
      const listeners = [...completionListeners];
      completionListeners.clear();
      for (const listener of listeners) listener();
    },
  };
}

export function isSessionTransitionActive(): boolean {
  return transitionState.activeToken !== null;
}

// New tRPC operations wait instead of crossing from the old identity into the
// new session. A successful navigation unloads them; a failed logout releases
// them back into the still-valid page.
export function runAfterSessionTransition(callback: () => void): () => void {
  if (!isSessionTransitionActive()) {
    callback();
    return () => undefined;
  }

  completionListeners.add(callback);
  return () => completionListeners.delete(callback);
}
