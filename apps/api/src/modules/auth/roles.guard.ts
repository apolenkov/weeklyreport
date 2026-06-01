import { type Role, roleSchema } from "@customreport/shared";

export interface GuardContext {
  user?: {
    role?: Role;
  };
}

export interface RoleGuard {
  canActivate: (context: GuardContext) => boolean;
}

export function createRoleGuard(requiredRole: Role): RoleGuard {
  roleSchema.parse(requiredRole);

  return {
    canActivate(context) {
      return context.user?.role === requiredRole;
    },
  };
}
