import type { RevealTransition } from "../../../matrix/reveal-transition.ts";
import type { RevealQueueInput } from "./preflight-reveal-branches.ts";
import type { RevealBranch } from "./preflight-reveal-branches.ts";

export type RevealActionResult = Readonly<{
  readonly branch: RevealBranch;
  readonly transition: RevealTransition;
  readonly explore: boolean;
}>;

export type RevealExecutionContext = Pick<
  RevealQueueInput,
  "harness" | "state" | "route" | "initialSurface"
>;
