import { z } from 'zod';

/**
 * UFB-047 / Phase 48-A: organization identity singleton schema.
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
  id: z.literal('singleton'),
  shortName: z.string().min(1).max(16),
  fullName: z.string().min(1).max(200),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Input shape for `admin.updateOrganization`. The id is implicit
 * (`'singleton'`) on the write path — clients can never address a
 * non-singleton row, so we don't accept an id in the input.
 */
export const organizationUpdateSchema = z.object({
  shortName: z.string().min(1).max(16),
  fullName: z.string().min(1).max(200),
});

/**
 * Public/anonymous projection returned by `org.getPublic` and embedded in
 * `auth.me`'s session payload (hydrated per-request in the tRPC context).
 * Intentionally excludes timestamps and id — those are leak-free but add
 * no UX value to the public landing page.
 */
export const organizationPublicSchema = z.object({
  shortName: z.string().min(1).max(16),
  fullName: z.string().min(1).max(200),
});

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationPublic = z.infer<typeof organizationPublicSchema>;
