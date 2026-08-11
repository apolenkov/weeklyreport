import { createHash } from "node:crypto";

import type { AiProviderDraft, AiProviderProfile } from "@customreport/shared";

const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const ENDPOINT_IDENTITY_HEX_LENGTH = 32;

export type ResolvedProviderProfile = Readonly<{
  profile: AiProviderProfile;
  baseUrl: string;
  endpointIdentity: string;
  plannerModel: string;
  answerModel: string;
  embeddingModel: string;
  embeddingDimensions: number | null;
  semanticInputVersion: string;
}>;

export class ProviderUrlPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUrlPolicyError";
  }
}

const parseUrl = (value: string): URL => {
  const parsed = (() => {
    try {
      return new URL(value);
    } catch {
      throw new ProviderUrlPolicyError("Provider endpoint must be a valid URL");
    }
  })();
  if (!/^https?:$/iu.test(parsed.protocol)) {
    throw new ProviderUrlPolicyError(
      "Provider endpoint must use HTTP or HTTPS",
    );
  }
  if (parsed.username || parsed.password) {
    throw new ProviderUrlPolicyError(
      "Provider endpoint must not contain user info",
    );
  }
  if (parsed.search || parsed.hash) {
    throw new ProviderUrlPolicyError(
      "Provider endpoint must not contain a query or fragment",
    );
  }
  return parsed;
};

export const normalizeProviderBaseUrl = (value: string): string => {
  const parsed = parseUrl(value.trim());
  const pathnameParts = parsed.pathname.split("/").filter(Boolean);
  const pathname =
    pathnameParts.length > 0 ? `/${pathnameParts.join("/")}` : "";
  return `${parsed.origin}${pathname}`;
};

const allowedOrigins = (values: string): ReadonlySet<string> => {
  const origins = values
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => {
      const parsed = parseUrl(value);
      if (parsed.pathname !== "/") {
        throw new ProviderUrlPolicyError(
          "Allowed provider entries must be exact origins",
        );
      }
      return parsed.origin;
    });
  if (origins.length === 0) {
    throw new ProviderUrlPolicyError("Provider origin allowlist is empty");
  }
  return new Set(origins);
};

const assertAllowed = (baseUrl: string, origins: ReadonlySet<string>): void => {
  const origin = new URL(baseUrl).origin;
  if (!origins.has(origin)) {
    throw new ProviderUrlPolicyError("Provider endpoint is not allowlisted");
  }
};

export const providerEndpointIdentity = (
  profile: AiProviderProfile,
  normalizedBaseUrl: string,
): string => {
  const digest = createHash("sha256")
    .update(`${profile}\0${normalizedBaseUrl}`, "utf8")
    .digest("hex");
  return `${profile}:${digest.slice(0, ENDPOINT_IDENTITY_HEX_LENGTH)}`;
};

const endpointFor = (draft: AiProviderDraft): string => {
  if (draft.profile === "mistral") return MISTRAL_BASE_URL;
  if (draft.profile === "openrouter") return OPENROUTER_BASE_URL;
  if (!draft.baseUrl) {
    throw new ProviderUrlPolicyError("A custom provider endpoint is required");
  }
  return draft.baseUrl;
};

export const resolveProviderProfile = (
  draft: AiProviderDraft,
  allowedOriginList: string,
  semanticInputVersion: string,
): ResolvedProviderProfile => {
  const baseUrl = normalizeProviderBaseUrl(endpointFor(draft));
  assertAllowed(baseUrl, allowedOrigins(allowedOriginList));
  return {
    profile: draft.profile,
    baseUrl,
    endpointIdentity: providerEndpointIdentity(draft.profile, baseUrl),
    plannerModel: draft.plannerModel,
    answerModel: draft.answerModel,
    embeddingModel: draft.embeddingModel,
    embeddingDimensions: null,
    semanticInputVersion,
  };
};

export const embeddingScopeChanged = (
  left: Pick<
    ResolvedProviderProfile,
    | "endpointIdentity"
    | "embeddingModel"
    | "embeddingDimensions"
    | "semanticInputVersion"
  >,
  right: Pick<
    ResolvedProviderProfile,
    | "endpointIdentity"
    | "embeddingModel"
    | "embeddingDimensions"
    | "semanticInputVersion"
  >,
): boolean =>
  left.endpointIdentity !== right.endpointIdentity ||
  left.embeddingModel !== right.embeddingModel ||
  left.embeddingDimensions !== right.embeddingDimensions ||
  left.semanticInputVersion !== right.semanticInputVersion;

export const builtInProviderEndpoints = {
  mistral: MISTRAL_BASE_URL,
  openrouter: OPENROUTER_BASE_URL,
} as const;
