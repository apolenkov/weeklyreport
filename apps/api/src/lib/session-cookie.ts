/**
 * refactor-auth-exemplary-layering: the single source of truth for the session
 * cookie name. The set path (`auth.controller.createSessionCookie`), the clear
 * path (logout), the request-auth read (`trpc.context`), and the PDF worker's
 * session injection all resolve the name through here instead of repeating the
 * `?? "customreport_session"` literal, so the cleared/read cookie can never
 * drift from the cookie that was set.
 */
const SESSION_COOKIE_DEFAULT_NAME = "customreport_session";

export function resolveSessionCookieName(env: NodeJS.ProcessEnv): string {
  return env.AUTH_JWT_COOKIE_NAME ?? SESSION_COOKIE_DEFAULT_NAME;
}
