import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import { sha256Hex } from "./ids.ts";

export const stateForMatrixCase = (
  matrixCase: MatrixExecutableCase,
): CampaignMatrixState => {
  const axes = {
    role: matrixCase.role,
    route: `${matrixCase.role}:${matrixCase.catalogRoute}`,
    ...matrixCase.state,
  };
  return {
    stateId: matrixCase.stateId,
    profile: matrixCase.profile,
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
};
