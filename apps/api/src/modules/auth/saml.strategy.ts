import { type Role, SamlProfileSchema } from "@customreport/shared";
import {
  type PassportSamlConfig,
  Strategy as SamlStrategy,
  type VerifyWithoutRequest,
} from "@node-saml/passport-saml";

import { requireEnv } from "../../lib/env.js";

export type SamlStrategyOptions = PassportSamlConfig & {
  devMode: boolean;
};

/** Verified profile shape downstream consumers (auth.routes) expect. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- must stay a type alias: passed where a Record index signature is required (done(null, result.profile)), which an interface does not satisfy.
export type VerifiedSamlProfile = {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
};

const SAML_ENV_KEYS = [
  "KEYCLOAK_SAML_CALLBACK_URL",
  "KEYCLOAK_SAML_ENTRY_POINT",
  "KEYCLOAK_SAML_ISSUER",
  "KEYCLOAK_SAML_CERT",
] as const;

/**
 * True when ANY of the four SAML variables is present and non-blank. env.schema
 * keeps them `.optional()` so dev-login can boot without an IdP (all four
 * absent); its production fence requires them under NODE_ENV=production with
 * AUTH_DEV_MODE=false. This is deliberately "any", not "all": a PARTIAL set is
 * always a misconfiguration, so the caller proceeds into
 * `createSamlStrategyOptions`, whose requireEnv fails loud naming the missing
 * var instead of silently degrading to dev-login-only. Outside production the
 * boot-time guard for the no-SAML + no-dev-login combination is the throw in
 * `mountAuthRoutes`, not the schema fence.
  * @param env - The env argument.
 */
export function hasSamlEnv(env: NodeJS.ProcessEnv): boolean {
  return SAML_ENV_KEYS.some((key) => (env[key]?.trim() ?? "") !== "");
}

const validateNever = "never" as NonNullable<
  PassportSamlConfig["validateInResponseTo"]
>;
const validateAlways = "always" as NonNullable<
  PassportSamlConfig["validateInResponseTo"]
>;

// Tolerate small IdP/SP clock drift without accepting stale assertions.
const ACCEPTED_CLOCK_SKEW_MS = 5000;

/**
 * Create Saml Strategy Options.
 * @param env - The env argument.
 */
export function createSamlStrategyOptions(
  env: NodeJS.ProcessEnv,
): SamlStrategyOptions {
  // Narrow `devMode` to non-production: production ignores `AUTH_DEV_MODE`, and
  // the boot fence in `lib/dev-auth-fence.ts` refuses to start if either
  // dev-auth flag is set under `NODE_ENV=production`.
  const devMode = env.NODE_ENV !== "production" && env.AUTH_DEV_MODE === "true";

  if (devMode) {
    return {
      devMode,
      callbackUrl: requireEnv(env, "KEYCLOAK_SAML_CALLBACK_URL"),
      entryPoint: requireEnv(env, "KEYCLOAK_SAML_ENTRY_POINT"),
      issuer: requireEnv(env, "KEYCLOAK_SAML_ISSUER"),
      idpCert: requireEnv(env, "KEYCLOAK_SAML_CERT"),
      validateInResponseTo: validateNever,
      disableRequestedAuthnContext: true,
      signatureAlgorithm: "sha256",
      digestAlgorithm: "sha256",
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      acceptedClockSkewMs: ACCEPTED_CLOCK_SKEW_MS,
    };
  }

  return {
    devMode,
    callbackUrl: requireEnv(env, "KEYCLOAK_SAML_CALLBACK_URL"),
    entryPoint: requireEnv(env, "KEYCLOAK_SAML_ENTRY_POINT"),
    issuer: requireEnv(env, "KEYCLOAK_SAML_ISSUER"),
    idpCert: requireEnv(env, "KEYCLOAK_SAML_CERT"),
    validateInResponseTo: validateAlways,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: ACCEPTED_CLOCK_SKEW_MS,
  };
}

// Parse the raw SAML profile through the shared Zod schema so a missing or
// unrecognised attribute fails closed. devMode retains a permissive fallback
// for local development where no real IdP populates the assertion.
/**
 * Verify Saml Profile.
 * @param options - The options argument.
 * @param rawProfile - The rawProfile argument.
 */
export function verifySamlProfile(
  options: SamlStrategyOptions,
  rawProfile: Record<string, unknown> | null | undefined,
): { ok: true; profile: VerifiedSamlProfile } | { ok: false; error: Error } {
  if (!rawProfile) {
    return { ok: false, error: new Error("SAML profile is missing") };
  }

  if (options.devMode) {
    // rawProfile fields are `unknown` (Record<string, unknown>); take the first
    // string-typed candidate so a non-string attribute can't stringify to
    // "[object Object]" (no-base-to-string).
    const firstString = (...values: unknown[]): string | undefined =>
      values.find((v): v is string => typeof v === "string");
    const samlId =
      firstString(rawProfile.nameID, rawProfile.email) ?? "unknown-saml-id";
    const email = firstString(rawProfile.email) ?? "unknown@example.com";
    const displayName =
      firstString(rawProfile.displayName, rawProfile.cn) ?? "Unknown User";
    // The assertion carries no role: every SAML-provisioned user defaults to
    // viewer; admins assign real roles afterwards.
    return {
      ok: true,
      profile: { samlId, email, displayName, role: "viewer" },
    };
  }

  const parsed = SamlProfileSchema.safeParse({
    nameID: rawProfile.nameID,
    email: rawProfile.email,
    displayName: rawProfile.displayName ?? rawProfile.cn,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: new Error("SAML profile missing required nameID/email attribute"),
    };
  }

  // Same as the devMode branch: no role in the assertion, so default to viewer.
  return {
    ok: true,
    profile: {
      samlId: parsed.data.nameID,
      email: parsed.data.email,
      displayName: parsed.data.displayName ?? "Unknown User",
      role: "viewer",
    },
  };
}

/**
 * Create Saml Strategy.
 * @param options - The options argument.
 */
export function createSamlStrategy(options: SamlStrategyOptions): SamlStrategy {
  const verify: VerifyWithoutRequest = (profile, done) => {
    const result = verifySamlProfile(options, profile);
    if (!result.ok) {
      done(result.error);
      return;
    }
    done(null, result.profile);
  };

  return new SamlStrategy(options, verify, verify);
}
