import { getOrgPublic } from "../lib/server/get-org-public";
import { LoginPageClient } from "./login-page.client";

// Server-fetch org so SSR HTML and client first paint match.
export default async function LoginPage() {
  const initialOrg = await getOrgPublic();
  return <LoginPageClient initialOrg={initialOrg} />;
}
