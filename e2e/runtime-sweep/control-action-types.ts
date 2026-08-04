import type { Page } from "@playwright/test";

import type { Action, ActionOperation, DOMControl } from "./contracts.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";

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

export interface ControlActionInput {
  readonly page: Page;
  readonly control: ControlActionTarget;
  readonly action: Action;
  readonly recovery?: ControlActionRecovery;
  readonly observeOutcome?: () => Promise<ControlActionObservation>;
  readonly value?: string;
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
      readonly resetPerformed: true;
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
