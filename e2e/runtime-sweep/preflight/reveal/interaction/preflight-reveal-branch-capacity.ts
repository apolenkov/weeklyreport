import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

export const assertRevealControlCapacity = (
  count: number,
  maxControlsPerSegment: number,
): void => {
  if (!Number.isSafeInteger(maxControlsPerSegment) || maxControlsPerSegment < 1)
    throw new RevealDiscoveryError(
      "Reveal control bound must be a positive integer",
    );
  if (count > maxControlsPerSegment)
    throw new RevealDiscoveryError(
      `Reveal control bound exceeded: ${String(count)} controls; maxControlsPerSegment is ${String(maxControlsPerSegment)}`,
    );
};
