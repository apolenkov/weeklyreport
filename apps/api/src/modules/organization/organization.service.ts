import {
  type Organization,
  type OrganizationPublic,
  organizationPublicSchema,
  organizationSchema,
  type OrganizationUpdate,
} from "@weeklyreport/shared";

import type { AppLogger } from "../../lib/logger.js";

export interface OrganizationRepository {
  // The canonical init migration and seed establish the singleton. A missing
  // row is an invariant failure and must be surfaced, never created on read.
  readonly getOrganization: () => Promise<Organization>;
  // Implementations MUST keep id='singleton' — no new id is accepted on the wire.
  readonly updateOrganization: (
    input: OrganizationUpdate,
  ) => Promise<Organization>;
}

// Singleton Organization identity; audit on write lives in the router
// (session/IP/correlation-id), not here.
export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly logger: AppLogger,
  ) {}

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
