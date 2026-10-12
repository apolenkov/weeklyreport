import type { DbRole } from "@weeklyreport/shared";

export function buildDevLoginHref(
  role: DbRole,
  email: string,
  redirect?: string,
): string {
  const params = new URLSearchParams({ role, email });
  if (redirect !== undefined) params.set("redirect", redirect);
  return `/auth/dev-login?${params.toString()}`;
}
