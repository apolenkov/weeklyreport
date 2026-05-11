import 'server-only';

import type { OrganizationPublic } from '@customreport/shared';
import { DEFAULT_ORGANIZATION_IDENTITY } from '@customreport/shared';

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
 * deploy and the cache is invalidated on the next deploy automatically.
 */
function resolveApiUrl(): string {
  return process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
}

type TrpcBatchEntry = {
  readonly result?: { readonly data?: unknown };
  readonly error?: { readonly message?: string };
};

function decodeOrgPublicResponse(body: unknown): OrganizationPublic | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const entry = body[0] as TrpcBatchEntry | undefined;
  if (!entry || entry.error) return null;
  const data = entry.result?.data;
  if (data === null || data === undefined) return null;
  // superjson transformer wraps in { json: <payload> }
  const payload =
    typeof data === 'object' && 'json' in (data as Record<string, unknown>)
      ? (data as { json: unknown }).json
      : data;
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p['shortName'] !== 'string' || typeof p['fullName'] !== 'string') return null;
  return { shortName: p['shortName'], fullName: p['fullName'] };
}

export async function getOrgPublic(): Promise<OrganizationPublic> {
  const apiUrl = resolveApiUrl();
  const inputParam = encodeURIComponent('{"0":{}}');
  const url = `${apiUrl}/trpc/org.getPublic?batch=1&input=${inputParam}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache',
      next: { revalidate: 60 },
    });
    if (!response.ok) return DEFAULT_ORGANIZATION_IDENTITY;
    const body = (await response.json()) as unknown;
    return decodeOrgPublicResponse(body) ?? DEFAULT_ORGANIZATION_IDENTITY;
  } catch {
    return DEFAULT_ORGANIZATION_IDENTITY;
  }
}
