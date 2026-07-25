import {
  type Organization,
  type OrganizationPublic,
  organizationPublicSchema,
  organizationSchema,
  type OrganizationUpdate,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";

export interface OrganizationRepository {
  // Implementations MUST return a row even on fresh DBs (upsert with seed
  // defaults) so the public landing page always has a brand to render.
  getOrganization(): Promise<Organization>;
  // Implementations MUST keep id='singleton' — no new id is accepted on the wire.
  updateOrganization(input: OrganizationUpdate): Promise<Organization>;
}

// Singleton Organization identity. TODO(multi-org): drop id='singleton',
// take organizationId from session on every read. Audit on write lives in
// the router (session/IP/correlation-id), not here.
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
    this.logger.info("updated organization", {
      shortName: next.shortName,
      fullName: next.fullName,
    });
    return organizationSchema.parse(next);
  }
}
