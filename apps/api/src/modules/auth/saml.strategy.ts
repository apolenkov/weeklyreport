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

export interface VerifiedSamlProfile extends Record<string, unknown> {
  readonly samlId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
}

const SAML_ENV_KEYS = [
  "KEYCLOAK_SAML_CALLBACK_URL",
  "KEYCLOAK_SAML_ENTRY_POINT",
  "KEYCLOAK_SAML_ISSUER",
  "KEYCLOAK_SAML_CERT",
] as const;

// Deliberately ANY, not all: a PARTIAL set is always a misconfiguration, so the
// caller proceeds into createSamlStrategyOptions, whose requireEnv fails loud
// naming the missing var instead of silently degrading to dev-login-only.
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

export function createSamlStrategyOptions(
  env: NodeJS.ProcessEnv,
): SamlStrategyOptions {
  // Narrow `devMode` to non-production: production ignores `AUTH_DEV_MODE`, and
  // the boot fence in `lib/dev-auth-fence.ts` refuses to start if either
  // dev-auth flag is set under `NODE_ENV=production`.
  const devMode = env.NODE_ENV !== "production" && env.AUTH_DEV_MODE === "true";

  // devMode is the ONLY divergence, and only on InResponseTo replay checking —
  // one object so the signing/assertion options cannot drift between branches.
  return {
    devMode,
    callbackUrl: requireEnv(env, "KEYCLOAK_SAML_CALLBACK_URL"),
    entryPoint: requireEnv(env, "KEYCLOAK_SAML_ENTRY_POINT"),
    issuer: requireEnv(env, "KEYCLOAK_SAML_ISSUER"),
    idpCert: requireEnv(env, "KEYCLOAK_SAML_CERT"),
    validateInResponseTo: devMode ? validateNever : validateAlways,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: ACCEPTED_CLOCK_SKEW_MS,
  };
}

// `displayName` is optional in SamlProfileSchema but required downstream; a
// nameless assertion is a misconfigured IdP mapping and must fail provisioning,
// not persist a placeholder identity the admin has to hunt down.
export function verifySamlProfile(
  _options: SamlStrategyOptions,
  rawProfile: Record<string, unknown> | null | undefined,
): { ok: true; profile: VerifiedSamlProfile } | { ok: false; error: Error } {
  if (!rawProfile) {
    return { ok: false, error: new Error("SAML profile is missing") };
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

  const displayName = parsed.data.displayName;
  if (!displayName || displayName.trim() === "") {
    return {
      ok: false,
      error: new Error("SAML profile missing displayName attribute"),
    };
  }

  // Assertions do not assign application roles; admins do that after provision.
  return {
    ok: true,
    profile: {
      samlId: parsed.data.nameID,
      email: parsed.data.email,
      displayName,
      role: "viewer",
    },
  };
}

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
