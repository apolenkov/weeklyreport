import type { MatrixPreflightControl } from "../../../matrix/finalization/matrix-finalizer-preflight-contract.ts";
import {
  revealControlPreparationIdentityFor,
  surfaceSignatureFor,
} from "../../reveal-path.ts";
import { contentDigestFor } from "./preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";
import type { RevealReducerCheckpoint } from "./preflight-reveal-continuation-schemas.ts";

const controlsByIdentityFor = (
  controls: readonly MatrixPreflightControl[],
): ReadonlyMap<string, MatrixPreflightControl> => {
  const indexed = new Map<string, MatrixPreflightControl>();
  for (const control of controls) {
    const identity = revealControlPreparationIdentityFor(
      control.controlKey,
      control.revealPath,
      control.expectedSurface,
    );
    if (indexed.has(identity))
      throw new RevealContinuationError(
        "R192 reducer checkpoint has duplicate control identities",
      );
    indexed.set(identity, control);
  }
  return indexed;
};

const registrationForCheckpoint = (
  controlsByIdentity: ReadonlyMap<string, MatrixPreflightControl>,
  entry: RevealReducerCheckpoint["discovered"][number],
) => {
  const [identity, value] = entry;
  const control = controlsByIdentity.get(identity);
  if (control === undefined)
    throw new RevealContinuationError(
      "R192 reducer checkpoint discovered control reference is unavailable",
    );
  const surfaceControl = control.expectedSurface.controls.find(
    ({ controlKey }) => controlKey === control.controlKey,
  );
  if (surfaceControl === undefined)
    throw new RevealContinuationError(
      "R192 reducer signature source is unavailable",
    );
  const signature = surfaceSignatureFor(surfaceControl);
  const signatureDigest = contentDigestFor("reducer-signature", { signature });
  if (signatureDigest !== value.signatureDigest)
    throw new RevealContinuationError("R192 reducer signature digest drifted");
  if (
    control.revealPath.digest !== value.pathDigest ||
    control.expectedSurface.digest !== value.surfaceDigest
  )
    throw new RevealContinuationError(
      "R192 reducer registration binding drifted",
    );
  return [
    identity,
    {
      signature,
      pathDigest: value.pathDigest,
      surfaceDigest: value.surfaceDigest,
    },
  ] as const;
};

export const registrationsForCheckpoint = (
  controls: readonly MatrixPreflightControl[],
  entries: RevealReducerCheckpoint["discovered"],
) => {
  const controlsByIdentity = controlsByIdentityFor(controls);
  return entries.map((entry) =>
    registrationForCheckpoint(controlsByIdentity, entry),
  );
};
