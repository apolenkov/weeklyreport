import type { SetStateAction } from "react";

export function createOverviewInputMemory<Value>() {
  const values = new Map<string, Value>();
  const listeners = new Set<() => void>();
  return {
    read: (reportId: string): Value | null => values.get(reportId) ?? null,
    hasInput: () => values.size > 0,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    write: (reportId: string, action: SetStateAction<Value | null>) => {
      const previous = values.get(reportId) ?? null;
      const next =
        typeof action === "function"
          ? (action as (value: Value | null) => Value | null)(previous)
          : action;
      if (Object.is(previous, next)) return;
      if (next === null) values.delete(reportId);
      else values.set(reportId, next);
      listeners.forEach((listener) => listener());
    },
  };
}
