import type { ReactNode } from "react";

import type { Role } from "@customreport/shared";

import { ForbiddenPage } from "../../../../components/forbidden-page";
import { getServerSession } from "../../../../lib/server/get-server-session";

/**
 * UFB-057 / Phase 57: nested role gate for the head weekly-report
 * submission surface.
 *
 * The parent /head/layout.tsx widened its allow-list to include
 * 'director' so the leadership-audience role can land on
 * /head/dashboard. That widening would also unlock /head/report, which
 * is the authoring surface for a head's weekly report — directors are
 * read-only and must not author one. This layer narrows the allow-list
 * back to {head, admin}, mirroring the original Phase 29-03 contract
 * for /head/* before the director split.
 *
 * Pattern: nested SSR layout for the surface that needs tighter gating
 * than its parent. Keeps the broad-gate-at-top pattern intact for
 * /head/dashboard (the common case) while protecting the authoring path.
 */
const REQUIRED: ReadonlyArray<Role> = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default async function HeadReportLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return <ForbiddenPage requiredRoles={REQUIRED} />;
  }
  return <>{children}</>;
}
