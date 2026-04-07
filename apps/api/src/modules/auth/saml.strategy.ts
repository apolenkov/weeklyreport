import { Strategy as SamlStrategy, type PassportSamlConfig, type VerifyWithoutRequest } from '@node-saml/passport-saml';

export type SamlStrategyOptions = PassportSamlConfig & {
  devMode: boolean;
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

export function createSamlStrategy(options: SamlStrategyOptions): SamlStrategy {
  const verify: VerifyWithoutRequest = (profile, done) => {
    if (!profile) {
      done(new Error('SAML profile is missing'));

      return;
    }

    done(null, {
      samlId: profile.nameID ?? profile.email ?? 'unknown-saml-id',
      email: profile.email ?? 'unknown@example.com',
      displayName: profile.displayName ?? profile.cn ?? 'Unknown User',
      role: profile.role ?? 'viewer',
    });
  };

  return new SamlStrategy(options, verify, verify);
}
