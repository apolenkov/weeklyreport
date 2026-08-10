type WebServerEnvironment = Readonly<Record<string, string>>;

export const runtimeSweepWebEnvironment = (
  environment: WebServerEnvironment | undefined,
): WebServerEnvironment => ({
  ...environment,
  // The API dev fallback reports a synthetic session without a cookie. Keep
  // the login client inert so anonymous protected routes do not redirect-loop.
  NEXT_PUBLIC_AUTH_STUB: "true",
  NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
});
