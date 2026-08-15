import { describe, expect, it } from "vitest";

import { createRevealExecutionGrant } from "../reveal/continuation/preflight-reveal-continuation-contract-factories.ts";
import { grantDigestForBody } from "../reveal/continuation/preflight-reveal-continuation-digests.ts";
import type { RevealExecutionGrant } from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { runContinuationChild } from "./preflight-reveal-continuation-parent-child.ts";
import { withSealedGrantFixture } from "./preflight-reveal-continuation-parent-test-fixture.ts";

describe("R188 parent-sealed grant security", () => {
  it("rejects source, authority, genesis, and snapshot drift before browser launch", async () => {
    await withSealedGrantFixture(async (fixture) => {
      const {
        context,
        validProgress,
        sealed,
        source,
        state,
        route,
        browserCalls,
        resetBrowserCalls,
      } = fixture;
      const assertNoBrowser = async (
        candidateContext: ParentContext,
        progress: ParentProgress,
        message: RegExp,
      ): Promise<void> => {
        resetBrowserCalls();
        await expect(
          runContinuationChild({
            context: candidateContext,
            progress,
            ordinal: 1,
          }),
        ).rejects.toThrow(message);
        expect(browserCalls()).toBe(0);
      };

      await assertNoBrowser(
        {
          ...context,
          selection: {
            ...context.selection,
            state: { ...context.selection.state, stateId: "foreign-state" },
          },
        },
        validProgress,
        /state or route binding drifted/u,
      );
      const foreignSelectorGrant = createRevealExecutionGrant({
        source,
        state,
        route,
        selector: {
          stateId: "foreign-selector",
          role: route.role,
          route: route.catalogRoute,
          profile: state.profile,
        },
        executionScope: "canary",
        attemptId: context.attemptId,
        chain: sealed.grant.chain,
        genesis: sealed.grant.genesis,
        frontier: sealed.grant.frontier,
        reducerState: sealed.grant.reducerState,
        bounds: sealed.grant.bounds,
        reducerStateDigest: sealed.grant.reducerStateDigest,
        authorityKey: context.authorityKey,
      });
      await assertNoBrowser(
        context,
        {
          ...validProgress,
          grant: foreignSelectorGrant,
          previousGrantDigest: foreignSelectorGrant.grantDigest,
        },
        /selector is not source-derived/u,
      );
      const wrongAuthorityGrant = createRevealExecutionGrant({
        source,
        state,
        route,
        executionScope: "canary",
        attemptId: context.attemptId,
        chain: sealed.grant.chain,
        genesis: sealed.grant.genesis,
        frontier: sealed.grant.frontier,
        reducerState: sealed.grant.reducerState,
        bounds: sealed.grant.bounds,
        reducerStateDigest: sealed.grant.reducerStateDigest,
        authorityKey: "b".repeat(64),
      });
      await assertNoBrowser(
        context,
        {
          ...validProgress,
          grant: wrongAuthorityGrant,
          previousGrantDigest: wrongAuthorityGrant.grantDigest,
        },
        /HMAC is invalid/u,
      );
      const { grantDigest: _grantDigest, ...tamperedBody } = {
        ...sealed.grant,
        frontier: {
          ...sealed.grant.frontier,
          nextCandidateIndex: sealed.grant.frontier.nextCandidateIndex + 1,
        },
      };
      const coherentlyDigestedTamper = {
        ...tamperedBody,
        grantDigest: grantDigestForBody(tamperedBody),
      } satisfies RevealExecutionGrant;
      await assertNoBrowser(
        context,
        {
          ...validProgress,
          grant: coherentlyDigestedTamper,
          previousGrantDigest: coherentlyDigestedTamper.grantDigest,
        },
        /HMAC is invalid/u,
      );
      await assertNoBrowser(
        context,
        {
          ...validProgress,
          genesis: {
            ...sealed.grant.genesis,
            inventoryDigest: "0".repeat(64),
          },
        },
        /genesis is not parent-derived/u,
      );
      const staleReducerStateGrant = createRevealExecutionGrant({
        source,
        state,
        route,
        executionScope: "canary",
        attemptId: context.attemptId,
        chain: sealed.grant.chain,
        genesis: sealed.grant.genesis,
        frontier: sealed.grant.frontier,
        reducerState: { checkpointRef: "f".repeat(64) },
        bounds: sealed.grant.bounds,
        reducerStateDigest: sealed.grant.reducerStateDigest,
        authorityKey: context.authorityKey,
      });
      await assertNoBrowser(
        context,
        {
          ...validProgress,
          grant: staleReducerStateGrant,
          previousGrantDigest: staleReducerStateGrant.grantDigest,
        },
        /reducer state snapshot is stale/u,
      );
    });
  });
});
