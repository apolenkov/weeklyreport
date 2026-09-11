import {
  appSettingsUpdateSchema,
  omitUndefinedProperties,
  organizationUpdateSchema,
} from "@customreport/shared";

import type { SnapshotAdminService } from "../../../../modules/admin/index.js";
import type { OrganizationService } from "../../../../modules/organization/index.js";
import { clearOrgCache } from "../../trpc.context.js";
import {
  mapDomainError,
  withDomainErrorMapping,
} from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminSettingsDeps {
  readonly snapshotAdminService: SnapshotAdminService;
  readonly organizationService: OrganizationService;
}

function createSnapshotSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    snapshot: adminProcedure.query(() =>
      withDomainErrorMapping(() => deps.snapshotAdminService.getSnapshot()),
    ),
    getSettings: adminProcedure.query(() =>
      withDomainErrorMapping(() => deps.snapshotAdminService.getSettings()),
    ),
    updateSettings: adminProcedure
      .input(appSettingsUpdateSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.snapshotAdminService.updateSettings(
            omitUndefinedProperties(input),
          ),
        ),
      ),
  };
}

function createOrganizationProcedures(deps: AdminSettingsDeps) {
  return {
    getOrganization: adminProcedure.query(() =>
      withDomainErrorMapping(() => deps.organizationService.getOrganization()),
    ),
    // Read before-state in the same call so audit has previous and new identity.
    updateOrganization: adminProcedure
      .input(organizationUpdateSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ ctx, input }) => {
        try {
          const previous = await deps.organizationService.getOrganization();
          const next = await deps.organizationService.updateOrganization(input);
          clearOrgCache();
          ctx.auditLogger.organizationUpdate({
            userId: ctx.session.userId,
            role: ctx.session.role,
            ip: ctx.ip,
            previousShortName: previous.shortName,
            previousFullName: previous.fullName,
            nextShortName: next.shortName,
            nextFullName: next.fullName,
          });
          return next;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}

export function createAdminSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    ...createSnapshotSettingsProcedures(deps),
    ...createOrganizationProcedures(deps),
  };
}
