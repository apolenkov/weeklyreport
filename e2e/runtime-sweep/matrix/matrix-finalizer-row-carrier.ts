import {
  type MatrixExecution,
  type MatrixExecutionInapplicable,
  type ResolverOutcomeKind,
} from "../source/contracts.ts";
import type { CampaignMatrixState } from "./campaign-matrix.ts";
import {
  type MatrixExecutableCase,
  matrixExecutableCaseSchema,
  MatrixFinalizationError,
  type MatrixInapplicableCase,
  matrixInapplicableCaseSchema,
  routeFor,
} from "./finalization/matrix-finalizer-contract.ts";
import {
  executionStateFor,
  identityFor,
} from "./finalization/matrix-finalizer-identity.ts";
import type {
  MatrixFinalizationInput,
  MatrixPreparation,
} from "./finalization/matrix-finalizer-preflight-contract.ts";
import { validateLegalMatrixRow } from "./policy/matrix-execution-policy.ts";

type MatrixIdentityFields = "sourceSha" | "sourceDigest" | "routes";

export const executable = (
  input: Pick<MatrixFinalizationInput, MatrixIdentityFields>,
  state: CampaignMatrixState,
  execution: MatrixExecution,
  identity?: unknown,
  preparation?: MatrixPreparation,
  resolverOutcome?: ResolverOutcomeKind,
): MatrixExecutableCase => {
  const route = routeFor(
    input.routes,
    state,
    input.sourceDigest,
    resolverOutcome,
  );
  if (route.binding === undefined)
    throw new MatrixFinalizationError(
      `Executable state is not assigned to a route: ${state.axes.route}:${state.profile}`,
    );
  const policy = validateLegalMatrixRow({
    state: executionStateFor(state.axes),
    execution,
  });
  if (!policy.ok)
    throw new MatrixFinalizationError(
      policy.issues
        .map(({ code, message }) => `${code}: ${message}`)
        .join("; "),
    );
  return matrixExecutableCaseSchema.parse({
    ...identityFor(input, state, route, identity ?? execution, preparation),
    execution,
  });
};

export const inapplicable = (
  input: Pick<MatrixFinalizationInput, MatrixIdentityFields>,
  state: CampaignMatrixState,
  reason: MatrixExecutionInapplicable,
  identity?: unknown,
  preparation?: MatrixPreparation,
): MatrixInapplicableCase =>
  matrixInapplicableCaseSchema.parse({
    ...identityFor(
      input,
      state,
      routeFor(input.routes, state, input.sourceDigest),
      identity ?? reason,
      preparation,
    ),
    kind: "inapplicable",
    inapplicable: reason,
  });
