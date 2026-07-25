// Boot fence: refuse production when either dev-auth flag is set, so an
// ops mis-config cannot promote DEV_SESSION (every user as head) into prod.
export function assertNoDevAuthInProduction(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;
  const devMode = env.AUTH_DEV_MODE === "true";
  const allowTest = env.AUTH_DEV_MODE_ALLOW_TEST === "true";
  if (devMode || allowTest) {
    throw new Error(
      "AUTH_DEV_MODE refused outside test/dev — set NODE_ENV=development to use dev auth, or unset both AUTH_DEV_MODE and AUTH_DEV_MODE_ALLOW_TEST in production.",
    );
  }
}
