import { describe, expect, it, vi } from "vitest";

vi.mock("../shared/server/organization/get-org-public", () => ({
  getOrgPublic: vi.fn(),
}));

vi.mock("./login-page.client", () => ({
  LoginPageClient: vi.fn(() => null),
}));

import { getOrgPublic } from "../shared/server/organization/get-org-public";
import { LoginPageClient } from "./login-page.client";
import LoginPage from "./page";

describe("LoginPage server boundary", () => {
  it("feeds the server-fetched organization into the client first paint", async () => {
    const organization = {
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    };
    vi.mocked(getOrgPublic).mockResolvedValue(organization);

    const element = await LoginPage();

    expect(getOrgPublic).toHaveBeenCalledOnce();
    expect(element.type).toBe(LoginPageClient);
    expect(element.props).toEqual({ initialOrg: organization });
  });
});
