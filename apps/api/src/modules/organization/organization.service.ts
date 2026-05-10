import {
  organizationSchema,
  organizationPublicSchema,
  type Organization,
  type OrganizationPublic,
  type OrganizationUpdate,
} from '@customreport/shared';

import { createNullLogger, type AppLogger } from '../../lib/logger.js';

export interface OrganizationRepository {
  /**
   * Reads the singleton `Organization` row. Implementations MUST return a
   * row even on fresh databases — the canonical implementation upserts
   * with seed defaults so the public landing page always renders the brand.
   */
  getOrganization(): Promise<Organization>;
  /**
   * Updates the singleton `Organization` row. Implementations MUST respect
   * the `id='singleton'` invariant — no new id is accepted on the wire.
   */
  updateOrganization(input: OrganizationUpdate): Promise<Organization>;
}

/**
 * UFB-047 / Phase 48-A: organization identity service.
 *
 * Owns the singleton `Organization` row. Two read paths:
 *  - {@link getOrganization}: returns the full row including timestamps;
 *    used by the admin Settings → Identity tab.
 *  - {@link getPublic}: returns only `{ shortName, fullName }`; used by
 *    the anonymous landing page (`org.getPublic` tRPC procedure) and by
 *    the tRPC context factory when hydrating `session.organization` on
 *    every authenticated request.
 *
 * The write path ({@link updateOrganization}) is admin-only; the
 * `admin.organization.update` audit event is emitted by the router (where
 * the session/IP/correlation-id are in scope), not by the service.
 */
export class OrganizationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: OrganizationRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  async getOrganization(): Promise<Organization> {
    return organizationSchema.parse(await this.repository.getOrganization());
  }

  async getPublic(): Promise<OrganizationPublic> {
    const row = await this.repository.getOrganization();
    return organizationPublicSchema.parse({
      shortName: row.shortName,
      fullName: row.fullName,
    });
  }

  async updateOrganization(input: OrganizationUpdate): Promise<Organization> {
    const next = await this.repository.updateOrganization(input);
    this.logger.info('updated organization', {
      shortName: next.shortName,
      fullName: next.fullName,
    });
    return organizationSchema.parse(next);
  }
}
