import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../../shared/ui/role-gate";

/** Nested role gate for the head weekly-report submission surface. */
const REQUIRED: readonly Role[] = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function HeadReportLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
