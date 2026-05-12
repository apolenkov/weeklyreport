import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import { ForbiddenPage } from '../../../components/forbidden-page';
import { getServerSession } from '../../../lib/server/get-server-session';

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /head/* routes.
 *
 * Mirrors the api's headProcedure — only roles that act as head pass the
 * gate. admin is included because adminProcedure === headProcedure for
 * v6.0 (D-AUTH-03).
 *
 * UFB-057 / Phase 57: 'director' included so the leadership-audience role
 * lands on /head/dashboard (its post-login home) and consumes the same
 * product-KPI surface. The submission surface `/head/report` has its own
 * nested layout (apps/web/src/app/(app)/head/report/layout.tsx) that
 * narrows the allow-list back to {head, admin} — director is read-only
 * and must not author a weekly report.
 */
const REQUIRED: ReadonlyArray<Role> = ['head', 'admin', 'director'];

type Props = Readonly<{ children: ReactNode }>;

export default async function HeadLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return <ForbiddenPage requiredRoles={REQUIRED} />;
  }
  return <>{children}</>;
}
