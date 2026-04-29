import { z } from 'zod';

import { sessionRoleSchema, type Role } from '../schemas/auth';

/**
 * AUTH-02 (Phase 29-02): strict schema for the SAML assertion profile we
 * accept from Keycloak.
 *
 * Threat-model notes:
 *  - T1 (A-2 PITFALLS): role is REQUIRED, not defaulted; if the Keycloak
 *    attribute mapper is misconfigured and `role` is absent, parse fails
 *    and login is rejected — no silent over-grant via undefined.
 *  - T2: Keycloak may emit roles in mixed case ('HEAD' vs 'head'); the
 *    inner transform normalises to lowercase before the enum check so a
 *    case mismatch is not a deny.
 *  - The schema is `.strict()` so unknown attributes (the raw SAML XML
 *    assertion, sessionIndex, etc.) are rejected at parse time; the
 *    consumer in saml.strategy.ts re-builds a minimal whitelisted shape
 *    before running the schema, so the strict check guards against new
 *    Keycloak fields silently propagating into the JWT payload.
 *
 * `Role` is re-exported from `../schemas/auth` (Phase 27 widening) — single
 * source of truth across the package.
 */
export const SamlProfileSchema = z
  .object({
    nameID: z.string().min(1),
    email: z.email(),
    displayName: z.string().optional(),
    role: z
      .string()
      .transform((s) => s.toLowerCase())
      .pipe(sessionRoleSchema),
  })
  .strict();

export type SamlProfile = z.infer<typeof SamlProfileSchema>;

export type { Role };
