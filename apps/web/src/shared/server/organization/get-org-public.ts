import "server-only";

import type { OrganizationPublic } from "@customreport/shared";
import {
  DEFAULT_ORGANIZATION_IDENTITY,
  organizationPublicSchema,
} from "@customreport/shared";
import * as Sentry from "@sentry/nextjs";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import {
  decodeTrpcBatchPayload,
  requireApiUrl,
  TRPC_BATCH_EMPTY_INPUT,
} from "../transport/api-url";

// Request timed revalidation every 60 seconds. After an admin rename,
// /api/revalidate-org also calls revalidatePath("/", "layout").
const ORG_PUBLIC_REVALIDATE_SECONDS = 60;

// Named branches so a report says which step failed, not just that one did.
const UNRESOLVED_BRANCH = {
  httpStatus: "http-status",
  decode: "decode",
  transport: "transport",
} as const;

type UnresolvedBranch =
  (typeof UNRESOLVED_BRANCH)[keyof typeof UNRESOLVED_BRANCH];

// This feeds the ROOT generateMetadata, so throwing blanks every route, not
// just the landing page — identity degrades to the generic constant instead.
// stderr is the sink every deployment has; Sentry adds nothing where no DSN is set.
function reportUnresolvedIdentity(
  branch: UnresolvedBranch,
  cause: unknown,
): OrganizationPublic {
  const message = `org.getPublic unresolved (${branch}) — serving the generic organization identity`;
  console.error(`[get-org-public] ${message}`, cause);
  Sentry.captureException(new Error(message, { cause }), {
    tags: { org_public_branch: branch },
  });
  return DEFAULT_ORGANIZATION_IDENTITY;
}

function decodeOrgPublicResponse(body: unknown): OrganizationPublic | null {
  const payload = decodeTrpcBatchPayload(body);
  const result = organizationPublicSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export async function getOrgPublic(): Promise<OrganizationPublic> {
  // There is no running API while Next prerenders the image. Runtime requests
  // revalidate the identity, so the build uses the same deliberate fallback
  // without reporting an expected transport failure as a production error.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD)
    return DEFAULT_ORGANIZATION_IDENTITY;

  const apiUrl = requireApiUrl();
  const url = `${apiUrl}/trpc/org.getPublic?batch=1&input=${TRPC_BATCH_EMPTY_INPUT}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "force-cache",
      next: { tags: ["org-public"], revalidate: ORG_PUBLIC_REVALIDATE_SECONDS },
    });
    if (!response.ok)
      return reportUnresolvedIdentity(
        UNRESOLVED_BRANCH.httpStatus,
        `HTTP ${response.status}`,
      );
    const body = (await response.json()) as unknown;
    return (
      decodeOrgPublicResponse(body) ??
      reportUnresolvedIdentity(UNRESOLVED_BRANCH.decode, body)
    );
  } catch (error) {
    return reportUnresolvedIdentity(UNRESOLVED_BRANCH.transport, error);
  }
}
