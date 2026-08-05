import type { Page } from "@playwright/test";

import type { DomInventory } from "./dom-inventory.ts";
import type { FrozenCaseLiveRuntime } from "./frozen-case-live-actions.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import type { RuntimeMatrixSource } from "./runtime-matrix.ts";
import type { RuntimeEvents } from "./runtime-matrix-evidence.ts";
import type { PreparedRuntimeState } from "./state-preparation.ts";

export type RuntimeEventWindow = Pick<
  RuntimeEvents,
  "consoleMessages" | "pageErrors" | "requestFailures"
>;

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
  readonly onInventory?: (inventory: DomInventory) => void;
}
