import { type Role, ROLE_HOME_PATH } from "@weeklyreport/shared";
import type { ReactNode } from "react";

import { getServerSession } from "../../server/auth/get-server-session";
import { ForbiddenPage } from "./forbidden-page";

// UX-only SSR gate: denied sessions render ForbiddenPage in place; API role
// middleware remains the security boundary.
interface RoleGateProps {
  readonly allowedRoles: readonly Role[];
  readonly children: ReactNode;
}

export async function RoleGate({
  allowedRoles,
  children,
}: RoleGateProps): Promise<ReactNode> {
  const session = await getServerSession();
  if (session && allowedRoles.includes(session.role)) {
    return children;
  }
  return (
    <ForbiddenPage
      requiredRoles={allowedRoles}
      homeHref={session ? ROLE_HOME_PATH[session.role] : "/"}
    />
  );
}
