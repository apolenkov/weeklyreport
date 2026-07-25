import { type Role, ROLE_HOME_PATH } from "@customreport/shared";
import type { ReactNode } from "react";

import { getServerSession } from "../../lib/server/get-server-session";
import { ForbiddenPage } from "./forbidden-page";

/**
 * Shared SSR role gate (spec: `ui-role-route-access`).
 *
 * Wrap a route segment's children to restrict it to `allowedRoles`. Allowed
 * sessions get the children back unwrapped (no extra DOM element); denied
 * visitors (no session, or role outside `allowedRoles`) get the in-page
 * `ForbiddenPage` wall at the requested URL — never a redirect — with
 * `homeHref` resolved via the shared role-home map, or `/` for anonymous
 * visitors.
 *
 * UX gate ONLY — layouts do not re-render on soft navigation and a layout
 * gate does not stop a page segment's server code. The actual security
 * boundary is the API's tRPC role middleware (threat model T1 in
 * `get-server-session.ts`). Never advertise this component as enforcement.
 */
interface RoleGateProps {
  readonly allowedRoles: readonly Role[];
  readonly children: ReactNode;
}

/**
 * Role Gate.
 * @param props - The props argument.
 */
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
