import { z } from "zod";

import {
  canonicalRevealUrlFor,
  type RevealNonMutationProof,
  revealNonMutationProofSchema,
  type RevealSurface,
} from "../preflight/reveal-path.ts";
import {
  type Action,
  actionSchema,
  sha256DigestSchema,
} from "../source/contracts.ts";
import { sha256Hex } from "../support/ids.ts";

const revealTransitionBodySchema = z
  .object({
    action: actionSchema,
    representativeInput: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("fill"), value: z.string() }).strict(),
        z
          .object({
            kind: z.literal("select"),
            value: z.string(),
            index: z.number().int().nonnegative(),
          })
          .strict(),
      ])
      .nullable(),
    beforeSurfaceDigest: sha256DigestSchema,
    afterSurfaceDigest: sha256DigestSchema,
    beforeUrl: z.string().min(1),
    afterUrl: z.string().min(1),
    nonMutation: revealNonMutationProofSchema,
  })
  .strict();

export const revealTransitionSchema = revealTransitionBodySchema
  .extend({ digest: sha256DigestSchema })
  .strict();

export type RevealTransition = z.infer<typeof revealTransitionSchema>;
export type RevealRepresentativeInput = NonNullable<
  RevealTransition["representativeInput"]
>;

const assertRepresentativeInput = (transition: RevealTransition): void => {
  const operation = transition.action.operation;
  const representative = transition.representativeInput;
  const formOperation = operation === "fill" || operation === "select";
  if (
    formOperation !== (representative !== null) ||
    (representative !== null && representative.kind !== operation)
  )
    throw new Error(
      "Reveal transition representative input does not match its action",
    );
};

const transitionBodyFor = (
  action: Action,
  before: RevealSurface,
  after: RevealSurface,
  beforeUrl: string,
  afterUrl: string,
  nonMutation: RevealNonMutationProof,
  representativeInput: RevealRepresentativeInput | null,
) => ({
  action,
  representativeInput,
  beforeSurfaceDigest: before.digest,
  afterSurfaceDigest: after.digest,
  beforeUrl: canonicalRevealUrlFor(beforeUrl),
  afterUrl: canonicalRevealUrlFor(afterUrl),
  nonMutation,
});

export const revealTransitionFor = (
  action: Action,
  before: RevealSurface,
  after: RevealSurface,
  beforeUrl: string,
  afterUrl: string,
  nonMutation: RevealNonMutationProof,
  representativeInput: RevealRepresentativeInput | null = null,
): RevealTransition => {
  const body = transitionBodyFor(
    action,
    before,
    after,
    beforeUrl,
    afterUrl,
    nonMutation,
    representativeInput,
  );
  return { ...body, digest: sha256Hex(body) };
};

export const parseRevealTransition = (value: unknown): RevealTransition => {
  const transition = revealTransitionSchema.parse(value);
  const { digest: _digest, ...bodyValue } = transition;
  const body = revealTransitionBodySchema.parse(bodyValue);
  assertRepresentativeInput(transition);
  if (
    transition.beforeUrl !== canonicalRevealUrlFor(transition.beforeUrl) ||
    transition.afterUrl !== canonicalRevealUrlFor(transition.afterUrl) ||
    transition.digest !== sha256Hex(body)
  )
    throw new Error("Reveal transition digest or URL identity does not match");
  return transition;
};
