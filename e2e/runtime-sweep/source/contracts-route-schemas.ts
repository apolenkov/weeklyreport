import { z } from "zod";

import type {
  landingRouteSchema,
  matrixConstraintIdSchema,
  resolverKeySchema,
  resolverOutcomeKindSchema,
  roleSchema,
  routeBindingTargetSchema,
  routeNetworkPolicySchema,
  routeUrlSchema,
  seedCapabilitySchema,
  seedProfileSchema,
  sha256DigestSchema,
  stableIdentifierSchema,
} from "./contracts.ts";

type RuntimeRouteSchemaInput = Readonly<{
  readonly routeUrlSchema: typeof routeUrlSchema;
  readonly landingRouteSchema: typeof landingRouteSchema;
  readonly roleSchema: typeof roleSchema;
  readonly seedProfileSchema: typeof seedProfileSchema;
  readonly routeBindingTargetSchema: typeof routeBindingTargetSchema;
  readonly resolverKeySchema: typeof resolverKeySchema;
  readonly resolverOutcomeKindSchema: typeof resolverOutcomeKindSchema;
  readonly stableIdentifierSchema: typeof stableIdentifierSchema;
  readonly sha256DigestSchema: typeof sha256DigestSchema;
  readonly matrixConstraintIdSchema: typeof matrixConstraintIdSchema;
  readonly seedCapabilitySchema: typeof seedCapabilitySchema;
  readonly routeNetworkPolicySchema: typeof routeNetworkPolicySchema;
  readonly seedProfileCount: number;
  readonly resolverOutcomeKinds: readonly z.infer<
    typeof resolverOutcomeKindSchema
  >[];
}>;

function createResolverOutcomeSchemas(input: RuntimeRouteSchemaInput) {
  const {
    resolverKeySchema,
    resolverOutcomeKindSchema,
    seedProfileSchema,
    stableIdentifierSchema,
    sha256DigestSchema,
    matrixConstraintIdSchema,
    resolverOutcomeKinds,
  } = input;
  const resolverOutcomeIdentitySchema = z
    .object({
      resolverKey: resolverKeySchema,
      outcome: resolverOutcomeKindSchema,
      profile: seedProfileSchema,
      stateId: stableIdentifierSchema,
      stateDigest: sha256DigestSchema,
    })
    .strict();
  const sourceBoundResolverOutcomeSchema = resolverOutcomeIdentitySchema
    .extend({ sourceDigest: sha256DigestSchema })
    .strict();
  const resolverOutcomeInapplicableSchema = z
    .object({
      profile: seedProfileSchema,
      constraintId: matrixConstraintIdSchema,
      reason: z.string().trim().min(1),
    })
    .strict();
  const resolverOutcomeKindsSchema = z
    .array(resolverOutcomeKindSchema)
    .length(resolverOutcomeKinds.length)
    .readonly()
    .refine(
      (outcomes) =>
        new Set(outcomes).size === resolverOutcomeKinds.length &&
        resolverOutcomeKinds.every((outcome) => outcomes.includes(outcome)),
      "resolver outcomes must cover every declared outcome exactly once",
    );

  return {
    resolverOutcomeIdentitySchema,
    sourceBoundResolverOutcomeSchema,
    resolverOutcomeInapplicableSchema,
    resolverOutcomeKindsSchema,
  };
}

function createRouteBindingSchema(
  input: RuntimeRouteSchemaInput,
  resolverOutcomeSchemas: ReturnType<typeof createResolverOutcomeSchemas>,
) {
  const {
    routeUrlSchema,
    landingRouteSchema,
    seedProfileSchema,
    routeBindingTargetSchema,
    resolverKeySchema,
    resolverOutcomeKindSchema,
    seedCapabilitySchema,
  } = input;
  const { resolverOutcomeKindsSchema } = resolverOutcomeSchemas;
  const routeBindingFields = {
    profile: seedProfileSchema,
    target: routeBindingTargetSchema,
    requiredCapability: seedCapabilitySchema.nullable(),
    resolvedRoute: routeUrlSchema,
  } as const;
  const unconditionalAssignedBindingSchema = z
    .object({
      ...routeBindingFields,
      status: z.literal("assigned"),
      kind: z.literal("unconditional").optional(),
      landingRoute: landingRouteSchema,
      rationale: z.string().min(1),
    })
    .strict();
  const resolverAssignedBindingSchema = z
    .object({
      ...routeBindingFields,
      status: z.literal("assigned"),
      kind: z.literal("resolver"),
      resolverKey: resolverKeySchema,
      resolverOutcomes: resolverOutcomeKindsSchema,
      landingRoute: z.never().optional(),
      rationale: z.string().min(1),
    })
    .strict();
  const unconditionalInapplicableBindingSchema = z
    .object({
      ...routeBindingFields,
      status: z.literal("not-applicable"),
      kind: z.literal("unconditional").optional(),
      landingRoute: landingRouteSchema,
      reason: z.string().min(1),
    })
    .strict();
  const resolverInapplicableBindingSchema = z
    .object({
      ...routeBindingFields,
      status: z.literal("not-applicable"),
      kind: z.literal("resolver"),
      resolverKey: resolverKeySchema,
      resolverOutcomes: z.array(resolverOutcomeKindSchema).length(0).readonly(),
      landingRoute: z.never().optional(),
      reason: z.string().min(1),
    })
    .strict();
  return z.union([
    unconditionalAssignedBindingSchema,
    resolverAssignedBindingSchema,
    unconditionalInapplicableBindingSchema,
    resolverInapplicableBindingSchema,
  ]);
}

function createRouteDeclarationSchema(
  input: RuntimeRouteSchemaInput,
  routeBindingSchema: ReturnType<typeof createRouteBindingSchema>,
  resolverOutcomeSchemas: ReturnType<typeof createResolverOutcomeSchemas>,
) {
  const {
    roleSchema,
    routeUrlSchema,
    routeNetworkPolicySchema,
    landingRouteSchema,
    resolverKeySchema,
    seedProfileCount,
  } = input;
  const { resolverOutcomeKindsSchema } = resolverOutcomeSchemas;
  const routeDeclarationFields = {
    role: roleSchema,
    catalogRoute: routeUrlSchema,
    resolvedRoute: routeUrlSchema,
    networkPolicy: routeNetworkPolicySchema,
    allowsCurrentLive: z.boolean().optional(),
    bindings: z
      .array(routeBindingSchema)
      .length(seedProfileCount)
      .readonly()
      .optional(),
  } as const;
  const unconditionalRouteDeclarationSchema = z
    .object({
      ...routeDeclarationFields,
      kind: z.literal("unconditional").optional(),
      resolverKey: z.never().optional(),
      resolverOutcomes: z.never().optional(),
      landingRoute: landingRouteSchema,
    })
    .strict();
  const resolverRouteDeclarationSchema = z
    .object({
      ...routeDeclarationFields,
      kind: z.literal("resolver"),
      resolverKey: resolverKeySchema,
      resolverOutcomes: resolverOutcomeKindsSchema,
      landingRoute: z.never().optional(),
    })
    .strict();
  return z
    .union([
      unconditionalRouteDeclarationSchema,
      resolverRouteDeclarationSchema,
    ])
    .superRefine((route, context) => {
      const isKnownResolver =
        route.role === "viewer" && route.catalogRoute === "/reports/latest";
      if (isKnownResolver && route.kind !== "resolver") {
        context.addIssue({
          code: "custom",
          path: ["kind"],
          message: "The viewer status resolver must declare kind=resolver",
        });
      }
      if (route.kind === "resolver" && !isKnownResolver) {
        context.addIssue({
          code: "custom",
          path: ["catalogRoute"],
          message: "Unknown resolver route",
        });
      }
    });
}

export function createRuntimeRouteSchemas(input: RuntimeRouteSchemaInput) {
  const resolverOutcomeSchemas = createResolverOutcomeSchemas(input);
  const routeBindingSchema = createRouteBindingSchema(
    input,
    resolverOutcomeSchemas,
  );
  const routeDeclarationSchema = createRouteDeclarationSchema(
    input,
    routeBindingSchema,
    resolverOutcomeSchemas,
  );
  return {
    ...resolverOutcomeSchemas,
    routeBindingSchema,
    routeDeclarationSchema,
  };
}
