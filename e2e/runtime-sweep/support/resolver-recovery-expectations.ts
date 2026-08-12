import type { ResolverOutcomeKind } from "../source/contracts.ts";
import {
  bindResolverOutcomeSourceDigest,
  freezeResolverOutcomeIdentity,
} from "./resolver-outcome-contract.ts";
import {
  resolverExpectedTargetFor,
  resolverExpectedUiFor,
  type ResolverOutcomeExpectation,
  ResolverOutcomeExpectationError,
} from "./resolver-outcome-expectations.ts";

/**
 * Rebinds a frozen resolver expectation to the explicitly declared recovery
 * outcome while preserving source/state identity from the original case.
 */
export const resolverRecoveryExpectationFor = (
  expected: ResolverOutcomeExpectation | undefined,
  recoveryOutcome: ResolverOutcomeKind | null | undefined,
): ResolverOutcomeExpectation => {
  if (expected === undefined)
    throw new ResolverOutcomeExpectationError(
      "Resolver recovery requires a frozen expected outcome",
    );
  if (recoveryOutcome === null || recoveryOutcome === undefined)
    throw new ResolverOutcomeExpectationError(
      `Resolver recovery outcome is missing for ${expected.identity.stateId}`,
    );
  const { sourceDigest, ...identity } = expected.identity;
  const recoveryIdentity = freezeResolverOutcomeIdentity({
    ...identity,
    outcome: recoveryOutcome,
  });
  return {
    identity: bindResolverOutcomeSourceDigest(recoveryIdentity, sourceDigest),
    expectedTarget: resolverExpectedTargetFor(recoveryOutcome),
    expectedUi: resolverExpectedUiFor(recoveryOutcome),
  };
};
