import {
  appSettingsUpdateSchema,
  omitUndefinedProperties,
  organizationUpdateSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import type { SnapshotAdminService } from "../../../../modules/admin/index.js";
import type { OrganizationService } from "../../../../modules/organization/index.js";
import { clearOrgCache } from "../../trpc.context.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminSettingsDeps {
  readonly snapshotAdminService: SnapshotAdminService;
  // Optional for role-coverage `{}` deps that never hit org.* paths.
  readonly organizationService?: OrganizationService;
}

// The optional deps are wiring, not request data: an unwired collaborator is a
// composition-root bug, so it surfaces as INTERNAL_SERVER_ERROR rather than a
// silent no-op.
function requireOrganizationService(
  deps: AdminSettingsDeps,
): OrganizationService {
  if (!deps.organizationService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "OrganizationService is not wired into the tRPC router.",
    });
  }
  return deps.organizationService;
}

function createSnapshotSettingsProcedures(deps: AdminSettingsDeps) {
  return {
    snapshot: adminProcedure.query(async () => {
      try {
        return await deps.snapshotAdminService.getSnapshot();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    getSettings: adminProcedure.query(async () => {
      try {
        return await deps.snapshotAdminService.getSettings();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    updateSettings: adminProcedure
      .input(appSettingsUpdateSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input }) => {
        try {
          return await deps.snapshotAdminService.updateSettings(
            omitUndefinedProperties(input),
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}

function createOrganizationProcedures(deps: AdminSettingsDeps) {
  return {
    getOrganization: adminProcedure.query(async () => {
      try {
        return await requireOrganizationService(deps).getOrganization();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    // Read before-state in the same call so audit has previous and new identity.
    updateOrganization: adminProcedure
      .input(organizationUpdateSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ ctx, input }) => {
        try {
          const organizationService = requireOrganizationService(deps);
          const previous = await organizationService.getOrganization();
          const next = await organizationService.updateOrganization(input);
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
