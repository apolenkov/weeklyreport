import { z } from "zod";

import {
  type RevealPath,
  revealPathSchema,
  type RevealSurface,
  revealSurfaceSchema,
} from "../../preflight/reveal-path.ts";
import { RUNTIME_DISCLOSURE_INDEPENDENCE } from "../../replay/dom/dom-inventory.ts";
import {
  type Action,
  actionSchema,
  type CampaignManifest,
  type MatrixExecution,
  type MatrixExecutionInapplicable,
  matrixExecutionSchema,
  matrixInapplicableSchema,
  resolverOutcomeKindSchema,
  sha256DigestSchema,
} from "../../source/contracts.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "../campaign-matrix.ts";
import {
  type RevealTransition,
  revealTransitionSchema,
} from "../reveal-transition.ts";

type Route = CampaignManifest["routes"][number];

export const matrixPreparationSchema = z
  .object({
    revealPathDigest: sha256DigestSchema,
    expectedSurfaceDigest: sha256DigestSchema,
    expectedActionTransitionDigest: sha256DigestSchema.nullable(),
  })
  .strict();

export type MatrixPreparation = z.infer<typeof matrixPreparationSchema>;

export interface MatrixPreflightControl {
  readonly controlKey: string;
  readonly inventory: Readonly<{
    readonly ariaRole: string;
    readonly accessibleName: string;
    readonly enabled: boolean;
    readonly order: number;
    readonly domOrderKey: string;
    readonly href: string | null;
    readonly ariaControls?: string | null | undefined;
    readonly ariaExpanded?: boolean | null | undefined;
    readonly disclosureIndependence?:
      (typeof RUNTIME_DISCLOSURE_INDEPENDENCE)[number] | undefined;
    readonly keyboardFocusScope?:
      "page" | "active-modal" | "background" | undefined;
  }>;
  readonly action?: Action | undefined;
  readonly execution?: MatrixExecution | undefined;
  readonly inapplicable?: MatrixExecutionInapplicable | undefined;
  readonly revealPath: RevealPath;
  readonly expectedSurface: RevealSurface;
  readonly expectedActionTransition: RevealTransition | null;
  readonly expectedActionSurface: RevealSurface | null;
}

export const matrixPreflightControlSchema: z.ZodType<MatrixPreflightControl> = z
  .object({
    controlKey: z.string().min(1),
    inventory: z
      .object({
        ariaRole: z.string().min(1),
        accessibleName: z.string(),
        enabled: z.boolean(),
        order: z.number().int().nonnegative(),
        domOrderKey: z.string().min(1),
        href: z.string().nullable(),
        ariaControls: z.string().min(1).nullable().optional(),
        ariaExpanded: z.boolean().nullable().optional(),
        disclosureIndependence: z
          .enum(RUNTIME_DISCLOSURE_INDEPENDENCE)
          .optional(),
        keyboardFocusScope: z
          .enum(["page", "active-modal", "background"])
          .optional(),
      })
      .strict(),
    action: actionSchema.optional(),
    execution: matrixExecutionSchema.optional(),
    inapplicable: matrixInapplicableSchema.optional(),
    revealPath: revealPathSchema,
    expectedSurface: revealSurfaceSchema,
    expectedActionTransition: revealTransitionSchema.nullable(),
    expectedActionSurface: revealSurfaceSchema.nullable(),
  })
  .strict()
  .refine(
    ({ action, execution, inapplicable }) =>
      Number(action !== undefined) +
        Number(execution !== undefined) +
        Number(inapplicable !== undefined) ===
      1,
    "A preflight control must declare exactly one action, execution, or inapplicable reason",
  );

export interface MatrixPreflightEntry {
  readonly declarationId?: string | undefined;
  readonly resolverOutcome?:
    z.infer<typeof resolverOutcomeKindSchema> | undefined;
  readonly resolverRecoveryOutcome?:
    z.infer<typeof resolverOutcomeKindSchema> | null | undefined;
  readonly state: CampaignMatrixState;
  readonly execution?: MatrixExecution | undefined;
  readonly inapplicable?: MatrixExecutionInapplicable | undefined;
}

export interface MatrixPreflightSegment {
  readonly state: CampaignMatrixState;
  readonly controls: readonly MatrixPreflightControl[];
  readonly specialized?: readonly MatrixPreflightEntry[] | undefined;
}

export interface MatrixFinalizationInput {
  readonly sourceSha: string;
  readonly sourceDigest?: string | undefined;
  readonly declaration: CampaignManifest["matrixDeclaration"];
  readonly plan: CampaignMatrixPlan;
  readonly routes: readonly Route[];
  readonly preflight: readonly MatrixPreflightSegment[];
  readonly maxCases: number;
  readonly maxControlsPerSegment: number;
}
