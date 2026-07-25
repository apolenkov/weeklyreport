import "server-only";

import type { OrganizationPublic } from "@customreport/shared";
import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";

import {
  decodeTrpcBatchPayload,
  requireApiUrl,
  TRPC_BATCH_EMPTY_INPUT,
} from "./api-url";

function decodeOrgPublicResponse(body: unknown): OrganizationPublic | null {
  const payload = decodeTrpcBatchPayload(body);
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.shortName !== "string" || typeof p.fullName !== "string")
    return null;
  return { shortName: p.shortName, fullName: p.fullName };
}

// force-cache + org-public tag: identity is deploy-stable; tag invalidates on admin rename.
// Failures fall back to DEFAULT_ORGANIZATION_IDENTITY so the landing page still renders.
const ORG_PUBLIC_REVALIDATE_SECONDS = 60;

/**
 * Get Org Public.
 */
export async function getOrgPublic(): Promise<OrganizationPublic> {
  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/org.getPublic?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "force-cache",
      next: { tags: ["org-public"], revalidate: ORG_PUBLIC_REVALIDATE_SECONDS },
    });
    if (!response.ok) return DEFAULT_ORGANIZATION_IDENTITY;
    const body = (await response.json()) as unknown;
    return decodeOrgPublicResponse(body) ?? DEFAULT_ORGANIZATION_IDENTITY;
  } catch {
    return DEFAULT_ORGANIZATION_IDENTITY;
  }
}
