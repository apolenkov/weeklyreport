import { z } from "zod";

/**
 * Strict Keycloak SAML profile with nameID, email, and optional displayName;
 * roles stay admin-assigned.
 * See `saml-provisioning` (.strict() rejects unknown attrs before JWT build).
 */
export const SamlProfileSchema = z
  .object({
    // nameID is an opaque stable identity: reject blanks, never trim or fold.
    nameID: z
      .string()
      .min(1)
      .refine((value) => value.trim().length > 0, {
        message: "nameID must contain non-whitespace characters",
      }),
    email: z.email(),
    displayName: z.string().optional(),
  })
  .strict()
  .readonly();
