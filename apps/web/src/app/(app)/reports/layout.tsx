import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

/**
 * SSR role gate for /reports/* routes.
 *
 * Any-authenticated-role surface — heads, leads, admins, and viewers all
 * read this surface but with different row visibility (archive.list /
 * weeklyReport.get scope by ctx.session.role at the service layer). The
 * layout's job is only to deny anonymous traffic; the service-layer filter
 * is the actual security boundary.
 */
const REQUIRED: readonly Role[] = ["lead", "head", "admin", "viewer"];

type Props = Readonly<{ children: ReactNode }>;

export default function ReportsLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
