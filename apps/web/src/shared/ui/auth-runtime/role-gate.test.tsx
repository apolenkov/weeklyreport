import { render, screen } from "@testing-library/react";
import type { UserSession } from "@weeklyreport/shared";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` inside get-server-session is aliased to a stub in
// apps/web/vitest.config.ts, so the module itself is importable here; the
// network-touching getServerSession is mocked below.
import { getServerSession } from "../../server/auth/get-server-session";
import { RoleGate } from "./role-gate";

vi.mock("../../server/auth/get-server-session", () => ({
  getServerSession: vi.fn(),
}));

const mockedGetServerSession = vi.mocked(getServerSession);

const baseSession: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "user@test.local",
  name: "User",
  role: "lead",
  activeReportId: null,
  activeReportSectionId: null,
};

function sessionWithRole(role: UserSession["role"]): UserSession {
  return { ...baseSession, role };
}

async function renderGate(
  allowedRoles: readonly UserSession["role"][],
  children = <p data-testid="gated-child">gated content</p>,
) {
  // RoleGate resolves to either the children element or the ForbiddenPage
  // element — both renderable; the cast narrows ReactNode for render().
  const ui = (await RoleGate({ allowedRoles, children })) as ReactElement;
  return render(ui);
}

function expectForbiddenWall(homeHref: string) {
  expect(screen.getByText(/page unavailable/i)).toBeInTheDocument();
  expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
  const homeLink = screen.getByRole("link", { name: "Go to my home page" });
  expect(homeLink).toHaveAttribute("href", homeHref);
}

describe("RoleGate (ui-role-route-access)", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
  });

  it("renders children unwrapped when the session role is allowed", async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("head"));
    const { container } = await renderGate(["head", "admin"]);
    expect(screen.getByTestId("gated-child")).toBeInTheDocument();
    // No wrapper element: the child is the container's only direct child.
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(screen.getByTestId("gated-child"));
  });

  it("denies a role outside allowedRoles with the joined label and the role's home", async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("viewer"));
    await renderGate(["head", "admin"]);
    expect(
      screen.getByText(/available to the head or admin role only/i),
    ).toBeInTheDocument();
    expectForbiddenWall("/reports/latest");
  });

  it("denies an anonymous visitor with the / home fallback", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    await renderGate(["admin"]);
    expectForbiddenWall("/");
  });

  it("denies a lead with the lead's own report home", async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("lead"));
    await renderGate(["head", "admin"]);
    expectForbiddenWall("/lead/report");
  });

  // Pins the lead-preview exactly-lead semantics BEFORE the page migrates:
  // head and admin pass the /lead layout but must NOT pass a ["lead"] gate.
  it('allowedRoles=["lead"] denies head, with head home', async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("head"));
    await renderGate(["lead"]);
    expectForbiddenWall("/head/dashboard");
  });

  it('allowedRoles=["lead"] denies admin, with admin home', async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("admin"));
    await renderGate(["lead"]);
    expectForbiddenWall("/admin");
  });

  it('allowedRoles=["lead"] allows lead', async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("lead"));
    await renderGate(["lead"]);
    expect(screen.getByTestId("gated-child")).toBeInTheDocument();
    expect(screen.queryByText(/page unavailable/i)).not.toBeInTheDocument();
  });
});
