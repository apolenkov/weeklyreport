import { setTimeout as delay } from "node:timers/promises";

const TERMINATION_GRACE_MS = 5000;
const KILL_GRACE_MS = 1000;

type ProcessSignalSender = (pid: number, signal: NodeJS.Signals) => void;
export type WaitForMilliseconds = (milliseconds: number) => Promise<void>;

export type ChildGroupTerminationInput = Readonly<{
  readonly pid: number | undefined;
  readonly completion: Promise<number>;
  readonly sendSignal?: ProcessSignalSender;
  readonly wait?: WaitForMilliseconds;
  readonly termGraceMs?: number;
  readonly killGraceMs?: number;
}>;

const signalOwnedChildGroup: ProcessSignalSender = (pid, signal) => {
  const target =
    process.platform === "darwin" || process.platform === "linux" ? -pid : pid;
  try {
    process.kill(target, signal);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH"))
      throw error;
  }
};

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
  if (input.pid === undefined)
    throw new Error("Cannot terminate diagnostic child without an owned PID");
  const sendSignal = input.sendSignal ?? signalOwnedChildGroup;
  const wait = input.wait ?? ((milliseconds: number) => delay(milliseconds));
  sendSignal(input.pid, "SIGTERM");
  if (
    await childSettledBefore({
      completion: input.completion,
      wait,
      timeoutMs: input.termGraceMs ?? TERMINATION_GRACE_MS,
    })
  )
    return;
  sendSignal(input.pid, "SIGKILL");
  if (
    !(await childSettledBefore({
      completion: input.completion,
      wait,
      timeoutMs: input.killGraceMs ?? KILL_GRACE_MS,
    }))
  )
    throw new Error("Diagnostic child did not settle after SIGKILL");
};
