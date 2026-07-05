import "server-only";

import type { OrganizationPublic } from "@customreport/shared";
import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";

import { decodeTrpcBatchPayload, requireApiUrl } from "./api-url";

/**
 * UFB-070 (2026-05-11): server-only helper that pre-fetches the org identity
 * for SSR injection into layout.tsx, eliminating the "ORG · Organization"
 * flash on the landing page.
 *
 * Follows the same pattern as get-server-session.ts — batched tRPC GET with
 * the superjson transformer shape. `org.getPublic` is a publicProcedure (no
 * auth required).
 *
 * On any failure (API down, network error, bad shape) returns
 * DEFAULT_ORGANIZATION_IDENTITY so the landing page still renders correctly.
 * `cache: 'force-cache'` is intentional — org identity is stable across a
 * deploy and the cache is revalidated via POST /api/revalidate-org when
 * admin updates shortName/fullName in settings.
 *
 * A9 (2026-05-12): Added `tags: ['org-public']` for explicit cache invalidation
 * after admin settings update (previously relied on 60s revalidate interval).
 */
function decodeOrgPublicResponse(body: unknown): OrganizationPublic | null {
  const payload = decodeTrpcBatchPayload(body);
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.shortName !== "string" || typeof p.fullName !== "string")
    return null;
  return { shortName: p.shortName, fullName: p.fullName };
}

export async function getOrgPublic(): Promise<OrganizationPublic> {
  const apiUrl = requireApiUrl();
  const inputParam = encodeURIComponent('{"0":{}}');
  const url = `${apiUrl}/trpc/org.getPublic?batch=1&input=${inputParam}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "force-cache",
      next: { tags: ["org-public"], revalidate: 60 },
    });
    if (!response.ok) return DEFAULT_ORGANIZATION_IDENTITY;
    const body = (await response.json()) as unknown;
    return decodeOrgPublicResponse(body) ?? DEFAULT_ORGANIZATION_IDENTITY;
  } catch {
    return DEFAULT_ORGANIZATION_IDENTITY;
  }
}
