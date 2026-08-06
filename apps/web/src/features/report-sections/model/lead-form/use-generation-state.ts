"use client";

import { useCallback, useState } from "react";

export function useGenerationState<T>(
  generation: string | null,
  initialValue: T,
): readonly [T, (next: T) => void] {
  const [values, setValues] = useState<Readonly<Record<string, T>>>({});
  const value =
    generation !== null && Object.hasOwn(values, generation)
      ? (values[generation] as T)
      : initialValue;
  const setValue = useCallback(
    (next: T) => {
      if (generation === null) return;
      setValues((current) => ({ ...current, [generation]: next }));
    },
    [generation],
  );
  return [value, setValue] as const;
}
