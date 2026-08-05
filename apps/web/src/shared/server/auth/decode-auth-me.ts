import "server-only";

import { type UserSession, userSessionSchema } from "@customreport/shared";

import { decodeTrpcBatchPayload } from "../transport/api-url";

export function decodeAuthMeResponse(body: unknown): UserSession | null {
  const payload = decodeTrpcBatchPayload(body);
  const result = userSessionSchema.safeParse(payload);
  return result.success ? result.data : null;
}
