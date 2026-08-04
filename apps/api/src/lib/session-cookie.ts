const SESSION_COOKIE_DEFAULT_NAME = "customreport_session";

export function resolveSessionCookieName(
  configuredName: string | undefined,
): string {
  return configuredName ?? SESSION_COOKIE_DEFAULT_NAME;
}
