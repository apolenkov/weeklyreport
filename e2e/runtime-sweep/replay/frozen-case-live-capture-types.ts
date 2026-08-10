import type { Page } from "@playwright/test";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { RuntimeMatrixSource } from "../matrix/runtime-matrix.ts";
import type {
  RuntimeEventCursor,
  RuntimeEvents,
} from "../matrix/runtime-matrix-evidence.ts";
import type { PreparedRuntimeState } from "../support/state-preparation.ts";
import type { DomInventory } from "./dom-inventory.ts";
import type { FrozenCaseLiveRuntime } from "./frozen-case-live-actions.ts";

export type RuntimeEventWindow = Readonly<{
  readonly startedAt: string;
  readonly cursor: RuntimeEventCursor;
  readonly collector: RuntimeEvents;
}>;

export interface FrozenPhaseInput {
  readonly page: Page;
  readonly source: RuntimeMatrixSource;
  readonly matrixCase: MatrixExecutableCase;
  readonly runtime: FrozenCaseLiveRuntime;
  readonly prepared: PreparedRuntimeState;
  readonly route: string;
  readonly responseStatus: number | null;
  readonly phase: "before" | "action" | "after";
  readonly initialEvents: RuntimeEventWindow;
  readonly eventCursor: RuntimeEventCursor;
  readonly onInventory?: (inventory: DomInventory) => void;
  readonly onActionTarget?: (target: DomInventory["controls"][number]) => void;
}
