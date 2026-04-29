import { Strategy as SamlStrategy, type PassportSamlConfig, type VerifyWithoutRequest } from '@node-saml/passport-saml';

import { SamlProfileSchema, type Role } from '@customreport/shared';

export type SamlStrategyOptions = PassportSamlConfig & {
  devMode: boolean;
};

/** Verified profile shape downstream consumers (auth.routes) expect. */
export type VerifiedSamlProfile = {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
};

const validateNever = 'never' as NonNullable<PassportSamlConfig['validateInResponseTo']>;
const validateAlways = 'always' as NonNullable<PassportSamlConfig['validateInResponseTo']>;

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function createSamlStrategyOptions(env: NodeJS.ProcessEnv): SamlStrategyOptions {
  const devMode = env.AUTH_DEV_MODE === 'true';

  if (devMode) {
    return {
      devMode,
      callbackUrl: env.KEYCLOAK_SAML_CALLBACK_URL ?? 'http://localhost:3001/auth/saml/callback',
      entryPoint: env.KEYCLOAK_SAML_ENTRY_POINT ?? 'http://localhost:8080/realms/dev/protocol/saml',
      issuer: env.KEYCLOAK_SAML_ISSUER ?? 'customreport-dev',
      idpCert: env.KEYCLOAK_SAML_CERT ?? 'DEV_MODE_CERT',
      validateInResponseTo: validateNever,
      disableRequestedAuthnContext: true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      acceptedClockSkewMs: 5_000,
    };
  }

  return {
    devMode,
    callbackUrl: requireEnv(env, 'KEYCLOAK_SAML_CALLBACK_URL'),
    entryPoint: requireEnv(env, 'KEYCLOAK_SAML_ENTRY_POINT'),
    issuer: requireEnv(env, 'KEYCLOAK_SAML_ISSUER'),
    idpCert: requireEnv(env, 'KEYCLOAK_SAML_CERT'),
    validateInResponseTo: validateAlways,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: 5_000,
  };
}

/**
 * AUTH-02 (Phase 29-02): the verify callback parses the raw SAML profile
 * through the shared Zod schema (`SamlProfileSchema`) so a missing or
 * unrecognised `role` attribute fails closed (A-2 mitigation).
 *
 * `options.devMode === true` retains the legacy permissive fallback for
 * local development and the Phase 26 / 28 integration suite — Phase 29-04
 * retires DEV_SESSION entirely once the mock IdP container is wired
 * (CC-2 staged removal).
 */
export function verifySamlProfile(
  options: SamlStrategyOptions,
  rawProfile: Record<string, unknown> | null | undefined,
): { ok: true; profile: VerifiedSamlProfile } | { ok: false; error: Error } {
  if (!rawProfile) {
    return { ok: false, error: new Error('SAML profile is missing') };
  }

  if (options.devMode) {
    const samlId = String(
      rawProfile['nameID'] ?? rawProfile['email'] ?? 'unknown-saml-id',
    );
    const email = String(rawProfile['email'] ?? 'unknown@example.com');
    const displayName = String(
      rawProfile['displayName'] ?? rawProfile['cn'] ?? 'Unknown User',
    );
    const rawRole = rawProfile['role'];
    const role: Role =
      typeof rawRole === 'string' && ['lead', 'head', 'admin', 'viewer'].includes(rawRole.toLowerCase())
        ? (rawRole.toLowerCase() as Role)
        : 'viewer';
    return { ok: true, profile: { samlId, email, displayName, role } };
  }

  const parsed = SamlProfileSchema.safeParse({
    nameID: rawProfile['nameID'],
    email: rawProfile['email'],
    displayName: rawProfile['displayName'] ?? rawProfile['cn'],
    role: rawProfile['role'],
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: new Error('SAML profile missing required role attribute'),
    };
  }

  return {
    ok: true,
    profile: {
      samlId: parsed.data.nameID,
      email: parsed.data.email,
      displayName: parsed.data.displayName ?? 'Unknown User',
      role: parsed.data.role,
    },
  };
}

export function createSamlStrategy(options: SamlStrategyOptions): SamlStrategy {
  const verify: VerifyWithoutRequest = (profile, done) => {
    const result = verifySamlProfile(
      options,
      profile as Record<string, unknown> | null | undefined,
    );
    if (!result.ok) {
      done(result.error);
      return;
    }
    done(null, result.profile);
  };

  return new SamlStrategy(options, verify, verify);
}
