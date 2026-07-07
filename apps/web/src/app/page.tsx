import { getOrgPublic } from "../lib/server/get-org-public";
import { LoginPageClient } from "./login-page.client";

/**
 * Thin RSC wrapper that server-fetches org identity and passes it
 * to the client component as a prop. This ensures SSR HTML and client first
 * paint use the same value — no hydration mismatch.
 *
 * All interactive logic (auth.me, role redirect, last-role hint) lives in
 * LoginPageClient (login-page.client.tsx).
 */
export default async function LoginPage() {
  const initialOrg = await getOrgPublic();
  return <LoginPageClient initialOrg={initialOrg} />;
}
