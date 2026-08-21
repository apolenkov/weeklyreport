import type { Action } from "../../../source/contracts.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "./preflight-reveal-branches.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

export class RevealCapacityOverflowError extends RevealDiscoveryError {
  override readonly name = "RevealCapacityOverflowError";

  readonly current: RevealBranch;
  readonly branch: RevealBranch;
  readonly state: RevealDiscoveryState;
  readonly action: Action;

  constructor(input: {
    readonly current: RevealBranch;
    readonly branch: RevealBranch;
    readonly state: RevealDiscoveryState;
    readonly action: Action;
    readonly message?: string;
  }) {
    super(input.message ?? "Reveal control capacity overflow");
    this.current = input.current;
    this.branch = input.branch;
    this.state = input.state;
    this.action = input.action;
  }
}
