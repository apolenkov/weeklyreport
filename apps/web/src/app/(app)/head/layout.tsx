import type { ReactNode } from "react";

import type { Role } from "@customreport/shared";

import { ForbiddenPage } from "../../../components/forbidden-page";
import { getServerSession } from "../../../lib/server/get-server-session";

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /head/* routes.
 *
 * Mirrors the api's headProcedure — only roles that act as head pass the
 * gate. admin is included because adminProcedure === headProcedure for
 * v6.0 (D-AUTH-03).
 */
const REQUIRED: ReadonlyArray<Role> = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default async function HeadLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return <ForbiddenPage requiredRoles={REQUIRED} />;
  }
  return <>{children}</>;
}
