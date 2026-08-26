import { setTimeout as delay } from "node:timers/promises";

const TERMINATION_GRACE_MS = 5000;
const KILL_GRACE_MS = 1000;

type ProcessSignalSender = (signal: NodeJS.Signals) => void;
export type WaitForMilliseconds = (milliseconds: number) => Promise<void>;

export type ChildGroupTerminationInput = Readonly<{
  readonly completion: Promise<number>;
  readonly signal?: ProcessSignalSender;
  readonly wait?: WaitForMilliseconds;
  readonly termGraceMs?: number;
  readonly killGraceMs?: number;
}>;

const childSettledBefore = async (input: {
  readonly completion: Promise<number>;
  readonly wait: WaitForMilliseconds;
  readonly timeoutMs: number;
}): Promise<boolean> =>
  Promise.race([
    input.completion.then(
      () => true,
      () => true,
    ),
    input.wait(input.timeoutMs).then(() => false),
  ]);

export const terminateOwnedChildGroup = async (
  input: ChildGroupTerminationInput,
): Promise<void> => {
  if (input.signal === undefined)
    throw new Error(
      "Cannot terminate diagnostic child without an owned handle",
    );
  const wait = input.wait ?? ((milliseconds: number) => delay(milliseconds));
  input.signal("SIGTERM");
  if (
    await childSettledBefore({
      completion: input.completion,
      wait,
      timeoutMs: input.termGraceMs ?? TERMINATION_GRACE_MS,
    })
  )
    return;
  input.signal("SIGKILL");
  if (
    !(await childSettledBefore({
      completion: input.completion,
      wait,
      timeoutMs: input.killGraceMs ?? KILL_GRACE_MS,
    }))
  )
    throw new Error("Diagnostic child did not settle after SIGKILL");
};
