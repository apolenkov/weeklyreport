import { type Role, roleSchema } from "@customreport/shared";

export type GuardContext = {
  user?: {
    role?: Role;
  };
};

export type RoleGuard = {
  canActivate: (context: GuardContext) => boolean;
};

export function createRoleGuard(requiredRole: Role): RoleGuard {
  roleSchema.parse(requiredRole);

  return {
    canActivate(context) {
      return context.user?.role === requiredRole;
    },
  };
}
