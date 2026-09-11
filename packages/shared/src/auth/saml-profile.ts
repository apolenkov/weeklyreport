import { z } from "zod";

import { type Role } from "../schemas/auth/auth";

/**
 * Strict Keycloak SAML profile with nameID, email, and optional displayName;
 * roles stay admin-assigned.
 * See `saml-provisioning` (.strict() rejects unknown attrs before JWT build).
 */
export const SamlProfileSchema = z
  .object({
    nameID: z.string().min(1),
    email: z.email(),
    displayName: z.string().optional(),
  })
  .strict()
  .readonly();

export type { Role };
