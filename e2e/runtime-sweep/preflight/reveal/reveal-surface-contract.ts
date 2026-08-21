import { z } from "zod";

import { RUNTIME_INTERACTION_EFFECTS } from "../../replay/dom/dom-inventory.ts";
import { sha256DigestSchema } from "../../source/contracts.ts";

const revealSurfaceControlSchema = z
  .object({
    controlKey: z.string().min(1),
    ariaRole: z.string().min(1),
    accessibleName: z.string(),
    enabled: z.boolean(),
    order: z.number().int().nonnegative(),
    domOrderKey: z.string().min(1),
    href: z.string().nullable(),
    interactionEffect: z.enum(RUNTIME_INTERACTION_EFFECTS).nullable(),
    ariaControls: z.string().min(1).nullable().optional(),
    ariaExpanded: z.boolean().nullable().optional(),
    keyboardFocusScope: z
      .enum(["page", "active-modal", "background"])
      .optional(),
  })
  .strict();

export const revealSurfaceSchema = z
  .object({
    controls: z.array(revealSurfaceControlSchema).readonly(),
    digest: sha256DigestSchema,
  })
  .strict();
