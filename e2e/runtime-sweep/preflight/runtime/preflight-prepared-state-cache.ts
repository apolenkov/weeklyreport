import type { PreparedRuntimeState } from "../../support/state-preparation.ts";

export interface PreparedStateCache {
  prepared:
    | Readonly<{
        readonly key: string;
        readonly prepared: PreparedRuntimeState;
      }>
    | undefined;
}
