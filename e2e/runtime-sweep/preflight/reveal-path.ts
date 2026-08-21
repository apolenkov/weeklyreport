import { z } from "zod";

import {
  DEFAULT_MAX_REVEAL_ACTIONS,
  DEFAULT_MAX_REVEAL_MATERIAL_EDGES,
} from "../matrix/matrix-limits.ts";
import {
  domControlDisclosureMetadataFor,
  type DomControlObservation,
  type RuntimeInteractionEffect,
} from "../replay/dom/dom-inventory.ts";
import type { Action } from "../source/contracts.ts";
import { actionSchema, sha256DigestSchema } from "../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import type { RevealRepresentativeInput } from "./reveal/interaction/preflight-reveal-transition.ts";
import { revealSurfaceSchema } from "./reveal/reveal-surface-contract.ts";
export { revealSurfaceSchema } from "./reveal/reveal-surface-contract.ts";

export const MAX_REVEAL_DEPTH = 4;
export const MAX_REVEAL_MATERIAL_EDGES = DEFAULT_MAX_REVEAL_MATERIAL_EDGES;
export const MAX_REVEAL_ACTIONS = DEFAULT_MAX_REVEAL_ACTIONS;

export type RevealSurfaceControl = Readonly<{
  readonly controlKey: string;
  readonly ariaRole: string;
  readonly accessibleName: string;
  readonly enabled: boolean;
  readonly order: number;
  readonly domOrderKey: string;
  readonly href: string | null;
  readonly interactionEffect: RuntimeInteractionEffect | null;
  readonly ariaControls?: string | null | undefined;
  readonly ariaExpanded?: boolean | null | undefined;
  readonly keyboardFocusScope?: DomControlObservation["keyboardFocusScope"];
}>;

export type RevealSurface = Readonly<{
  readonly controls: readonly RevealSurfaceControl[];
  readonly digest: string;
}>;

export type RevealStep = Readonly<
  Action & {
    readonly before: RevealSurface;
    readonly after: RevealSurface;
    readonly beforeUrl: string;
    readonly afterUrl: string;
    readonly nonMutation: RevealNonMutationProof;
    readonly representativeInput?: RevealRepresentativeInput | undefined;
  }
>;

export type RevealNonMutationProof = Readonly<{
  readonly status: "unchanged";
  readonly beforeDigest: string;
  readonly afterDigest: string;
}>;

export type RevealPath = Readonly<{
  readonly initialUrl: string;
  readonly steps: readonly RevealStep[];
  readonly digest: string;
}>;

export type RevealControlIdentity = Readonly<{
  readonly controlKey: string;
  readonly revealPathDigest: string;
  readonly expectedSurfaceDigest: string;
}>;

export const revealNonMutationProofSchema = z
  .object({
    status: z.literal("unchanged"),
    beforeDigest: sha256DigestSchema,
    afterDigest: sha256DigestSchema,
  })
  .strict();

export const isUnchangedRevealNonMutationProof = (
  value: unknown,
): value is RevealNonMutationProof => {
  const parsed = revealNonMutationProofSchema.safeParse(value);
  return parsed.success && parsed.data.beforeDigest === parsed.data.afterDigest;
};

const revealStepSchema = actionSchema
  .extend({
    before: revealSurfaceSchema,
    after: revealSurfaceSchema,
    beforeUrl: z.string().min(1),
    afterUrl: z.string().min(1),
    nonMutation: revealNonMutationProofSchema,
    representativeInput: z
      .discriminatedUnion("kind", [
        z
          .object({ kind: z.literal("fill"), value: z.string().min(1) })
          .strict(),
        z
          .object({
            kind: z.literal("select"),
            value: z.string().min(1),
            index: z.number().int().nonnegative(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict()
  .superRefine((action, context) => {
    const formAction =
      action.operation === "fill" || action.operation === "select";
    if (!formAction && action.operation !== "click")
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message: "Reveal steps must be click, fill, or select actions",
      });
    if (action.operation === "click" && action.safety !== "read-only")
      context.addIssue({
        code: "custom",
        path: ["safety"],
        message: "Click reveal steps must be read-only",
      });
    if (
      formAction &&
      (action.safety !== "irreversible" ||
        action.transition !== "none" ||
        action.representativeInput?.kind !== action.operation)
    )
      context.addIssue({
        code: "custom",
        path: ["representativeInput"],
        message:
          "Form reveal steps require irreversible none-transition and matching frozen input",
      });
    if (
      action.operation === "click" &&
      action.representativeInput !== undefined
    )
      context.addIssue({
        code: "custom",
        path: ["representativeInput"],
        message: "Click reveal steps cannot carry a form representative input",
      });
    if (
      !(["none", "open", "cancel"] as readonly string[]).includes(
        action.transition,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["transition"],
        message: "Reveal steps cannot encode stateful transitions",
      });
  });

export const revealPathSchema = z
  .object({
    initialUrl: z.string().min(1),
    steps: z.array(revealStepSchema).readonly(),
    digest: sha256DigestSchema,
  })
  .strict();

const sortedSurfaceControls = (
  controls: readonly RevealSurfaceControl[],
): readonly RevealSurfaceControl[] =>
  controls.toSorted((left, right) => {
    const byKey = left.controlKey.localeCompare(right.controlKey);
    return byKey || stableSerialize(left).localeCompare(stableSerialize(right));
  });

const assertSurfaceControls = (
  controls: readonly RevealSurfaceControl[],
): void => {
  if (
    new Set(controls.map(({ controlKey }) => controlKey)).size !==
    controls.length
  )
    throw new Error("Reveal surface contains duplicate control identities");
  if (
    stableSerialize(sortedSurfaceControls(controls)) !==
    stableSerialize(controls)
  )
    throw new Error("Reveal surface controls must be stable-sorted");
};

const revealSurfaceControlFor = (
  control: DomControlObservation,
): RevealSurfaceControl => ({
  controlKey: control.controlKey,
  ariaRole: control.role,
  accessibleName: control.accessibleName,
  enabled: control.enabled,
  order: control.order,
  domOrderKey: control.domOrderKey,
  href: control.href,
  interactionEffect: control.interactionEffect ?? null,
  ...domControlDisclosureMetadataFor(control),
});

export const revealSurfaceFor = (
  controls: readonly DomControlObservation[] | readonly RevealSurfaceControl[],
): RevealSurface => {
  const hasActiveModal = controls.some(
    (control) =>
      "role" in control && control.keyboardFocusScope === "active-modal",
  );
  const entries = controls
    .filter(
      (control) =>
        !hasActiveModal ||
        !("role" in control) ||
        control.keyboardFocusScope !== "background",
    )
    .map((control) =>
      "role" in control ? revealSurfaceControlFor(control) : { ...control },
    );
  const sorted = sortedSurfaceControls(entries);
  assertSurfaceControls(sorted);
  return { controls: sorted, digest: sha256Hex(sorted) };
};

export const revealPathFor = (
  steps: readonly RevealStep[] = [],
  initialUrl = "/",
): RevealPath => {
  const body = {
    initialUrl: canonicalRevealUrlFor(initialUrl),
    steps: [...steps],
  };
  return { ...body, digest: sha256Hex(body) };
};

export const canonicalRevealUrlFor = (value: string): string => {
  const url = new URL(value, "https://runtime-sweep.invalid");
  return `${url.pathname}${url.search}${url.hash}`;
};

export const revealStepFor = (
  action: Action,
  before: RevealSurface,
  after: RevealSurface,
  beforeUrl: string,
  afterUrl: string,
  nonMutation: RevealNonMutationProof,
  representativeInput?: RevealRepresentativeInput,
): RevealStep => ({
  ...action,
  before,
  after,
  beforeUrl: canonicalRevealUrlFor(beforeUrl),
  afterUrl: canonicalRevealUrlFor(afterUrl),
  nonMutation,
  ...(representativeInput === undefined ? {} : { representativeInput }),
});

export const parseRevealPath = (value: unknown): RevealPath => {
  const parsed = revealPathSchema.parse(value);
  if (
    canonicalRevealUrlFor(parsed.initialUrl) !== parsed.initialUrl ||
    sha256Hex({ initialUrl: parsed.initialUrl, steps: parsed.steps }) !==
      parsed.digest
  )
    throw new Error("Reveal path digest does not match steps");
  return parsed;
};

export const parseRevealSurface = (value: unknown): RevealSurface => {
  const parsed = revealSurfaceSchema.parse(value);
  assertSurfaceControls(parsed.controls);
  if (sha256Hex(parsed.controls) !== parsed.digest)
    throw new Error("Reveal surface digest does not match controls");
  return parsed;
};

export const surfaceSignatureFor = (control: RevealSurfaceControl): string =>
  stableSerialize(control);

export const revealControlIdentityFor = (
  identity: RevealControlIdentity,
): string => stableSerialize(identity);

export const revealControlPreparationIdentityFor = (
  controlKey: string,
  revealPath: Pick<RevealPath, "digest">,
  expectedSurface: Pick<RevealSurface, "digest">,
): string =>
  revealControlIdentityFor({
    controlKey,
    revealPathDigest: revealPath.digest,
    expectedSurfaceDigest: expectedSurface.digest,
  });

export const compareRevealControlIdentity = (
  left: RevealControlIdentity,
  right: RevealControlIdentity,
): number => {
  const byControlKey = left.controlKey.localeCompare(right.controlKey);
  if (byControlKey !== 0) return byControlKey;
  const byPath = left.revealPathDigest.localeCompare(right.revealPathDigest);
  return (
    byPath ||
    left.expectedSurfaceDigest.localeCompare(right.expectedSurfaceDigest)
  );
};

export {
  assertRevealPath,
  assertRevealPathForControl,
  assertRevealSegmentPreparations,
} from "./reveal/paths/reveal-path-validation.ts";
