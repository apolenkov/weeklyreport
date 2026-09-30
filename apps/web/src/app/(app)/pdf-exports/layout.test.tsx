// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { ROLE_HOME_PATH, type UserSession } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` inside get-server-session is aliased to a stub in
// apps/web/vitest.config.ts; the network-touching getServerSession is mocked.
import { getServerSession } from "../../../shared/server/auth/get-server-session";

vi.mock("../../../shared/server/auth/get-server-session", () => ({
  getServerSession: vi.fn(),
}));

import AdminLayout from "../admin/layout";
import PdfExportsLayout from "./layout";

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

const CHILD = <p data-testid="gated-child">gated content</p>;

type LayoutComponent = (props: { children: ReactNode }) => ReactNode;

// Layouts return a <RoleGate> element whose async function type jsdom cannot
// render; invoke awaited server components until plain elements remain.
async function renderLayout(Layout: LayoutComponent) {
  let node: ReactNode = Layout({ children: CHILD });
  while (
    isValidElement(node) &&
    typeof node.type === "function" &&
    node.type.constructor.name === "AsyncFunction"
  ) {
    node = await (node.type as (props: unknown) => Promise<ReactNode>)(
      node.props,
    );
  }
  return render(node as ReactElement);
}

describe("pdf-exports route role gate", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
  });

  it.each(["head", "admin"] as const)(
    "allows the %s role to render the page",
    async (role) => {
      mockedGetServerSession.mockResolvedValue(sessionWithRole(role));
      await renderLayout(PdfExportsLayout);
      expect(screen.getByTestId("gated-child")).toBeInTheDocument();
      expect(screen.queryByText(/page unavailable/i)).not.toBeInTheDocument();
    },
  );

  it.each(["lead", "viewer"] as const)(
    "denies the %s role with the forbidden wall",
    async (role) => {
      mockedGetServerSession.mockResolvedValue(sessionWithRole(role));
      await renderLayout(PdfExportsLayout);
      expect(screen.getByText(/page unavailable/i)).toBeInTheDocument();
      expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /go to my home page/i }),
      ).toHaveAttribute("href", ROLE_HOME_PATH[role]);
    },
  );

  it("still denies head on /admin — recovery access does not widen admin", async () => {
    mockedGetServerSession.mockResolvedValue(sessionWithRole("head"));
    await renderLayout(AdminLayout);
    expect(screen.getByText(/page unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /go to my home page/i }),
    ).toHaveAttribute("href", ROLE_HOME_PATH.head);
  });
});
