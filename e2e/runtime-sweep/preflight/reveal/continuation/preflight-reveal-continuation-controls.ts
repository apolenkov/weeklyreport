import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { compareRevealControlIdentity } from "../../reveal-path.ts";

export const sortedRevealControls = (
  controls: readonly MatrixPreflightControl[],
): readonly MatrixPreflightControl[] =>
  controls.toSorted((left, right) =>
    compareRevealControlIdentity(
      {
        controlKey: left.controlKey,
        revealPathDigest: left.revealPath.digest,
        expectedSurfaceDigest: left.expectedSurface.digest,
      },
      {
        controlKey: right.controlKey,
        revealPathDigest: right.revealPath.digest,
        expectedSurfaceDigest: right.expectedSurface.digest,
      },
    ),
  );
