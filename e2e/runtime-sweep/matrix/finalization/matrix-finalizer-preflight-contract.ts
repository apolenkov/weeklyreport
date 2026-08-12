import { z } from "zod";

import {
  type RevealPath,
  type RevealSurface,
} from "../../preflight/reveal-path.ts";
import {
  type Action,
  type CampaignManifest,
  type MatrixExecution,
  type MatrixExecutionInapplicable,
  resolverOutcomeKindSchema,
  sha256DigestSchema,
} from "../../source/contracts.ts";
import type {
  CampaignMatrixPlan,
  CampaignMatrixState,
} from "../campaign-matrix.ts";
import type { RevealTransition } from "../reveal-transition.ts";

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
  }>;
  readonly action?: Action | undefined;
  readonly execution?: MatrixExecution | undefined;
  readonly inapplicable?: MatrixExecutionInapplicable | undefined;
  readonly revealPath: RevealPath;
  readonly expectedSurface: RevealSurface;
  readonly expectedActionTransition: RevealTransition | null;
  readonly expectedActionSurface: RevealSurface | null;
}

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
  readonly maxCases?: number;
  readonly maxControlsPerSegment?: number;
}
