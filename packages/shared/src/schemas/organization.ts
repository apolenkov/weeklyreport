import { z } from "zod";

/** Maximum accepted length of the compact organization brand. */
export const MAX_SHORT_NAME_LENGTH = 16;
/** Maximum accepted length of the full organization brand. */
export const MAX_FULL_NAME_LENGTH = 200;

/**
 * Canonical singleton organization identity with display-safe brand limits.
 */
export const organizationSchema = z
  .object({
    id: z.literal("singleton"),
    shortName: z.string().min(1).max(MAX_SHORT_NAME_LENGTH),
    fullName: z.string().min(1).max(MAX_FULL_NAME_LENGTH),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .readonly();

// `<`/`>` are HTML tag delimiters and carry no legitimate brand meaning, so the
// admin write boundary rejects them as defence-in-depth: a stored org name can
// never reach an inline-script (or other markup) sink carrying breakout
// characters. The read/projection schemas below stay unconstrained — they parse
// values read FROM the database, so a legacy stored value must never make a
// read throw.
const orgBrandString = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => !v.includes("<") && !v.includes(">"), {
      message: "must not contain '<' or '>'",
    });

/**
 * Brand update input; the singleton identity is implicit and cannot be addressed by clients.
 */
export const organizationUpdateSchema = z
  .object({
    shortName: orgBrandString(MAX_SHORT_NAME_LENGTH),
    fullName: orgBrandString(MAX_FULL_NAME_LENGTH),
  })
  .readonly();

/**
 * Anonymous organization projection excluding persistence identity and timestamps.
 */
export const organizationPublicSchema = z
  .object({
    shortName: z.string().min(1).max(MAX_SHORT_NAME_LENGTH),
    fullName: z.string().min(1).max(MAX_FULL_NAME_LENGTH),
  })
  .readonly();

/** Persisted singleton organization identity. */
export type Organization = z.infer<typeof organizationSchema>;
/** Brand fields accepted for the implicit organization singleton. */
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
/** Anonymous organization brand projection. */
export type OrganizationPublic = z.infer<typeof organizationPublicSchema>;

/**
 * Immutable brand snapshot carried by asynchronous rendering jobs.
 */
export type OrganizationBrand = z.infer<typeof organizationPublicSchema>;

/**
 * Tenant-neutral placeholder used only before validated organization data is available.
 */
export const DEFAULT_ORGANIZATION_IDENTITY: OrganizationPublic = Object.freeze({
  shortName: "ORG",
  fullName: "Organization",
});
