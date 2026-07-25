// Single default so set/clear/read paths never drift on the cookie name.
const SESSION_COOKIE_DEFAULT_NAME = "customreport_session";

export function resolveSessionCookieName(env: NodeJS.ProcessEnv): string {
  return env.AUTH_JWT_COOKIE_NAME ?? SESSION_COOKIE_DEFAULT_NAME;
}
