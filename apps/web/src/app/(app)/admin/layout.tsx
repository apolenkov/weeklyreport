import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import { ForbiddenPage } from '../../../components/forbidden-page';
import { getServerSession } from '../../../lib/server/get-server-session';

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /admin/* routes.
 *
 * Layout-level UX gate — the actual security boundary is the api's role
 * middleware (Phase 27 + 29-01 audit emit). This async server component
 * renders the ForbiddenPage in-place when the role does not match, so the
 * user never sees admin shell chrome before the tRPC error surfaces.
 *
 * D-AUTH-03 (Phase 27): adminProcedure === headProcedure for v6.0, so the
 * admin segment accepts both 'admin' and 'head' roles.
 */
const REQUIRED: ReadonlyArray<Role> = ['admin', 'head'];

type Props = Readonly<{ children: ReactNode }>;

export default async function AdminLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return <ForbiddenPage requiredRoles={REQUIRED} />;
  }
  return <>{children}</>;
}
