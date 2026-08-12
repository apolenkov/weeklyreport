import type { Page } from "@playwright/test";

import {
  type RevealStep,
  type RevealSurfaceControl,
} from "../preflight/reveal-path.ts";
import { executeControlAction } from "./control-actions.ts";

export const executeFrozenRevealControl = async (
  page: Page,
  action: RevealStep,
  control: RevealSurfaceControl,
) =>
  executeControlAction({
    page,
    action,
    control,
    ...(action.representativeInput === undefined
      ? {}
      : { representativeInput: action.representativeInput }),
  });
