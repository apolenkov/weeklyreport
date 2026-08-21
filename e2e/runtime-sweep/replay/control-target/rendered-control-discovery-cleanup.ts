import type { ElementHandle } from "@playwright/test";

import type { RenderedTargetValidator } from "../control-actions/control-action-types.ts";
import {
  RENDERED_TARGET_GUARD_PROPERTY,
  RENDERED_TARGET_VALIDATOR_PROPERTY,
} from "./rendered-control-state.ts";

export const cleanupDiscoveryValidator = (
  handle: ElementHandle<HTMLElement>,
  generation: string,
): Promise<void> =>
  handle.evaluate(
    (element, expected) => {
      const guarded = element as HTMLElement & Record<string, unknown>;
      const validator = guarded[expected.validatorProperty] as
        RenderedTargetValidator | undefined;
      const guard = guarded[expected.guardProperty] as
        { readonly validator?: unknown } | undefined;
      if (
        validator?.generation === expected.generation &&
        guard?.validator !== validator
      )
        delete guarded[expected.validatorProperty];
    },
    {
      generation,
      guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
      validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
    },
  );
