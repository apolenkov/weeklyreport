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

type BudgetedChildInput = Readonly<{
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly runChild: typeof runContinuationChild;
  readonly remainingMs: number;
  readonly assertTerminalPublicationActive: () => void;
  /**
   * Aggregate partitions may close a window before launching the next child.
   * The handler is intentionally limited to errors before `runPlaywright` is
   * invoked; budget errors after that launch boundary remain terminal.
   */
  readonly onPrelaunchBudgetExhausted?: () => void | Promise<void>;
}>;

const handleBudgetError = async (input: {
  readonly childLaunchStarted: boolean;
  readonly error: unknown;
  readonly runner: BudgetedChildInput;
}): Promise<void> => {
  if (!isPublishableRevealContinuationBudgetError(input.error))
    throw input.error;
  if (
    !input.childLaunchStarted &&
    input.runner.onPrelaunchBudgetExhausted !== undefined
  ) {
    await input.runner.onPrelaunchBudgetExhausted();
    return;
  }
  await publishRevealContinuationBudgetFailure({
    context: input.runner.context,
    progress: input.runner.progress,
    ordinal: input.runner.ordinal,
    error: input.error,
    assertTerminalPublicationActive:
      input.runner.assertTerminalPublicationActive,
  });
};

export const runRevealContinuationChildWithBudget = async (
  input: BudgetedChildInput,
): Promise<Awaited<ReturnType<typeof runContinuationChild>> | undefined> => {
  const limits = input.context.continuationLimits ?? REVEAL_CONTINUATION_LIMITS;
  try {
    assertRevealContinuationChildBudget({
      remainingMs: input.remainingMs,
      hardWallMs: limits.hardWallMs,
      killGraceMs: limits.killGraceMs,
    });
  } catch (error: unknown) {
    await handleBudgetError({
      childLaunchStarted: false,
      error,
      runner: input,
    });
    return undefined;
  }
  const childLaunch = { started: false };
  const context: ParentContext = {
    ...input.context,
    runPlaywright: (...args) => {
      childLaunch.started = true;
      return input.context.runPlaywright(...args);
    },
  };
  try {
    return await input.runChild({
      context,
      progress: input.progress,
      ordinal: input.ordinal,
    });
  } catch (error: unknown) {
    await handleBudgetError({
      childLaunchStarted: childLaunch.started,
      error,
      runner: input,
    });
    return undefined;
  }
};
