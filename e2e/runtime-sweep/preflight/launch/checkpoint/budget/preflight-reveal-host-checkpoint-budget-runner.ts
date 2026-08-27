import { REVEAL_CONTINUATION_LIMITS } from "../../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../../continuation/preflight-reveal-continuation-parent.ts";
import {
  assertRevealContinuationChildBudget,
  runContinuationChild,
} from "../../continuation/preflight-reveal-continuation-parent-child.ts";
import {
  isPublishableRevealContinuationBudgetError,
  publishRevealContinuationBudgetFailure,
} from "./preflight-reveal-host-checkpoint-budget-failure.ts";

export const runRevealContinuationChildWithBudget = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly runChild: typeof runContinuationChild;
  readonly remainingMs: number;
  readonly assertTerminalPublicationActive: () => void;
  /**
   * Aggregate partitions may close a window before launching the next child.
   * The handler is intentionally limited to the pre-launch guard; budget
   * errors raised by the child itself remain terminal diagnostics.
   */
  readonly onPrelaunchBudgetExhausted?: () => void | Promise<void>;
}): Promise<Awaited<ReturnType<typeof runContinuationChild>> | undefined> => {
  const limits = input.context.continuationLimits ?? REVEAL_CONTINUATION_LIMITS;
  try {
    assertRevealContinuationChildBudget({
      remainingMs: input.remainingMs,
      hardWallMs: limits.hardWallMs,
      killGraceMs: limits.killGraceMs,
    });
  } catch (error: unknown) {
    if (!isPublishableRevealContinuationBudgetError(error)) throw error;
    if (input.onPrelaunchBudgetExhausted !== undefined) {
      await input.onPrelaunchBudgetExhausted();
      return undefined;
    }
    await publishRevealContinuationBudgetFailure({
      context: input.context,
      progress: input.progress,
      ordinal: input.ordinal,
      error,
      assertTerminalPublicationActive: input.assertTerminalPublicationActive,
    });
    return undefined;
  }
  try {
    return await input.runChild({
      context: input.context,
      progress: input.progress,
      ordinal: input.ordinal,
    });
  } catch (error: unknown) {
    if (!isPublishableRevealContinuationBudgetError(error)) throw error;
    await publishRevealContinuationBudgetFailure({
      context: input.context,
      progress: input.progress,
      ordinal: input.ordinal,
      error,
      assertTerminalPublicationActive: input.assertTerminalPublicationActive,
    });
    return undefined;
  }
};
