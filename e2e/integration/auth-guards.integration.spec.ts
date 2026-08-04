/**
 * Auth-guard integration tests.
 *
 * Verifies that proxy.ts and the API behave correctly when:
 *   - no cookie is present (redirect to login)
 *   - cookie is cleared mid-session (next request triggers redirect)
 *   - dev-login is called with an invalid role (400 response)
 */

import { expect, test } from "./fixtures";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3002}`;

test.describe("Auth guards (integration)", () => {
  test("unauthed user visiting /lead/report is redirected to login", async ({
    unauthedPage,
  }) => {
    await unauthedPage.goto("/lead/report", { waitUntil: "commit" });
    // proxy.ts redirects to '/' with ?next=<original path>.
    await expect(unauthedPage).toHaveURL(/\/\?next=/);
    expect(unauthedPage.url()).toContain("next=%2Flead%2Freport");
  });

  test("clearing the session cookie causes redirect on next navigation", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");
    await expect(leadPage).toHaveURL(/\/lead\/report/);

    await leadPage.context().clearCookies();
    await leadPage.goto("/lead/report", { waitUntil: "commit" });

    // Without the cookie, proxy.ts kicks back to login.
    await expect(leadPage).toHaveURL(/\/\?next=/);
  });

  test("dev-login with invalid role returns 400", async ({ unauthedPage }) => {
    const res = await unauthedPage
      .context()
      .request.get(`${API_URL}/auth/dev-login?role=hacker`, {
        maxRedirects: 0,
      });
    expect(res.status()).toBe(400);
  });
});
