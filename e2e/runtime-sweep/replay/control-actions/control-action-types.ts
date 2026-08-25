import type { ElementHandle, Locator, Page } from "@playwright/test";

import type { RevealRepresentativeInput } from "../../matrix/reveal-transition.ts";
import type {
  Action,
  ActionOperation,
  DOMControl,
} from "../../source/contracts.ts";
import type { ControlActionRecovery } from "../recovery/control-recovery.ts";

export type ControlActionTarget = Pick<
  DOMControl,
  "controlKey" | "ariaRole" | "accessibleName" | "enabled"
> &
  Readonly<{
    readonly inputType?: string | null;
    readonly tagName?: string;
    readonly href?: string | null;
  }>;

export type ControlActionObservation = "pass" | "fail";

export type ControlActionAttemptOutcome = Readonly<{
  readonly status: "pass" | "fail" | "ambiguous";
  readonly reason?: string;
}>;

export type ControlActionRecoveryOutcome =
  | Readonly<{ readonly status: "pass" }>
  | Readonly<{ readonly status: "fail"; readonly reason: string }>;

export interface ControlActionRecoveryBoundary {
  readonly beforeRecovery: (
    outcome: ControlActionAttemptOutcome,
  ) => Promise<void>;
  readonly afterRecovery: (
    outcome: ControlActionRecoveryOutcome,
  ) => Promise<void>;
}

export interface RenderedNameActionLease {
  readonly deadline: number;
  readonly generation: string;
}

export type RenderedTargetValidator = (() => boolean) &
  Readonly<{ generation: string }>;

export type ResolvedActionControl =
  | Readonly<{ readonly kind: "locator"; readonly target: Locator }>
  | Readonly<{
      readonly kind: "handle";
      readonly target: ElementHandle<HTMLElement>;
    }>;

export interface ControlActionInput {
  readonly page: Page;
  readonly control: ControlActionTarget;
  readonly action: Action;
  readonly recovery?: ControlActionRecovery;
  readonly recoveryBoundary?: ControlActionRecoveryBoundary;
  readonly observeOutcome?: () => Promise<ControlActionObservation>;
  readonly value?: string;
  readonly representativeInput?: RevealRepresentativeInput;
  readonly timeoutMs?: number;
}

export type ControlActionExecution =
  | Readonly<{
      readonly status: "pass" | "fail";
      readonly controlKey: string;
      readonly operation: ActionOperation;
      readonly resetPerformed: boolean;
      readonly reason?: string;
    }>
  | Readonly<{
      readonly status: "ambiguous";
      readonly controlKey: string;
      readonly operation: ActionOperation;
      readonly resetPerformed: boolean;
      readonly reason: string;
    }>
  | Readonly<{
      readonly status: "not-exercised";
      readonly controlKey: string;
      readonly operation: ActionOperation;
      readonly resetPerformed: false;
      readonly policy: "inapplicable" | "unsafe" | "unavailable";
      readonly reason: string;
    }>;
