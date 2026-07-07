import { z } from "zod";

import { type Role } from "../schemas/auth";

/**
 * Strict schema for the SAML assertion profile we accept from Keycloak.
 *
 * Threat-model notes:
 *  - Role is NOT carried by the assertion. Keycloak has no role attribute, so
 *    requiring it was impossible to satisfy. Every SAML-provisioned user
 *    defaults to `viewer` (least privilege); roles are assigned only by the
 *    admin. This is strictly safer than trusting an IdP-asserted role.
 *  - The schema is `.strict()` so unknown attributes (the raw SAML XML
 *    assertion, sessionIndex, etc.) are rejected at parse time; the
 *    consumer in saml.strategy.ts re-builds a minimal whitelisted shape
 *    before running the schema, so the strict check guards against new
 *    Keycloak fields silently propagating into the JWT payload.
 *
 * `Role` is re-exported from `../schemas/auth` — single source of truth
 * across the package.
 */
export const SamlProfileSchema = z
  .object({
    nameID: z.string().min(1),
    email: z.email(),
    displayName: z.string().optional(),
  })
  .strict();

export type SamlProfile = z.infer<typeof SamlProfileSchema>;

export type { Role };
