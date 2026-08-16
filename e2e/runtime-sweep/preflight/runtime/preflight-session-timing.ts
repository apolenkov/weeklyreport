import { SECONDS_PER_MINUTE } from "../../../../packages/shared/src/index.ts";

export const sessionRefreshSafetySecondsFor = (
  maxRevealDepth: number,
): number => {
  const safetySeconds = (maxRevealDepth + 1) * SECONDS_PER_MINUTE;
  if (
    !Number.isSafeInteger(maxRevealDepth) ||
    maxRevealDepth < 1 ||
    !Number.isSafeInteger(safetySeconds)
  )
    throw new Error(
      "Preflight session reveal depth must be a positive safe integer",
    );
  return safetySeconds;
};
