import { z } from "zod";

export const MAX_SHORT_NAME_LENGTH = 16;
export const MAX_FULL_NAME_LENGTH = 200;

/**
 * Organization identity singleton schema.
 *
 * `Organization` is the source-of-truth for brand strings rendered in the
 * application chrome (nav-bar, landing hero, PDF report header, email
 * subject prefix). One row per deployment with `id='singleton'`. Singleton
 * invariant is enforced at the application layer (`id='singleton'` upserts
 * in OrganizationService) rather than via a DB CHECK constraint, so a
 * future multi-tenant migration can evolve without a destructive schema
 * change.
 *
 * Field bounds:
 *   - shortName ≤ 16 chars (compact nav-bar slot; long values overflow the
 *     fixed-height brand pill).
 *   - fullName  ≤ 200 chars (landing hero subtitle; conservative cap
 *     prevents pathological copy from breaking PDF headers).
 */
export const organizationSchema = z.object({
  id: z.literal("singleton"),
  shortName: z.string().min(1).max(MAX_SHORT_NAME_LENGTH),
  fullName: z.string().min(1).max(MAX_FULL_NAME_LENGTH),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

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
 * Input shape for `admin.updateOrganization`. The id is implicit
 * (`'singleton'`) on the write path — clients can never address a
 * non-singleton row, so we don't accept an id in the input.
 */
export const organizationUpdateSchema = z.object({
  shortName: orgBrandString(MAX_SHORT_NAME_LENGTH),
  fullName: orgBrandString(MAX_FULL_NAME_LENGTH),
});

/**
 * Public/anonymous projection returned by `org.getPublic` and embedded in
 * `auth.me`'s session payload (hydrated per-request in the tRPC context).
 * Intentionally excludes timestamps and id — those are leak-free but add
 * no UX value to the public landing page.
 */
export const organizationPublicSchema = z.object({
  shortName: z.string().min(1).max(MAX_SHORT_NAME_LENGTH),
  fullName: z.string().min(1).max(MAX_FULL_NAME_LENGTH),
});

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationPublic = z.infer<typeof organizationPublicSchema>;

/**
 * Brand identity (`{shortName, fullName}`) threaded into email templates and
 * their BullMQ job payloads. Structurally the public projection — the enqueue
 * path snapshots `OrganizationService.getPublic()` into the job data, so the
 * worker re-renders with whatever the org row said at enqueue time, immune to
 * mid-flight admin edits of the brand strings.
 */
export type OrganizationBrand = z.infer<typeof organizationPublicSchema>;

/**
 * Generic fallback for the organization identity. Must NOT hard-code any
 * tenant's brand — doing so leaks one tenant's identity into a system meant
 * to be deployable for any organization.
 *
 *   - This constant is the SOLE in-code fallback when org.getPublic fails
 *     (offline first-boot, race on JWT hydration, etc.).
 *   - The real brand strings live exclusively in the Organization row of
 *     the database. The seed file (`prisma/seed-simple.ts`) is the only
 *     place that still names a concrete brand — and that's demo data, not
 *     a hard-coded fallback.
 *   - Under multi-org, this constant stays — it is the pre-tenant-resolution
 *     chrome render. Once a tenant resolves, real values from
 *     `session.organization` win.
 *
 * Keep these strings ASCII-only so they render in any monospace context
 * (terminal logs, fallback PDF chrome) without font fallback noise.
 */
export const DEFAULT_ORGANIZATION_IDENTITY: OrganizationPublic = {
  shortName: "ORG",
  fullName: "Organization",
};
