// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]): unknown => useQueryMock(...args),
}));

vi.mock("../../lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    auth: {
      me: {
        queryOptions: () => ({ queryKey: ["auth.me"] }),
      },
    },
  }),
}));

import { IfRole } from "./if-role";

function mockMe(role: string | null) {
  if (role === null) {
    useQueryMock.mockReturnValue({ data: null });
    return;
  }
  useQueryMock.mockReturnValue({
    data: {
      userId: "00000000-0000-4000-8000-000000000001",
      name: "Test User",
      email: "test@customreport.local",
      role,
    },
  });
}

describe("IfRole — role-guard wrapper", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("renders nothing while auth.me is still loading (no data yet)", () => {
    useQueryMock.mockReturnValue({ data: undefined });

    render(
      <IfRole forRole="admin">
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });

  it("renders nothing when the session resolves to null (unauthenticated)", () => {
    mockMe(null);

    render(
      <IfRole forRole="admin">
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });

  it("renders children when the single-role gate matches", () => {
    mockMe("admin");

    render(
      <IfRole forRole="admin">
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.getByTestId("gated")).toBeVisible();
  });

  it("renders nothing when the single-role gate does not match", () => {
    mockMe("head");

    render(
      <IfRole forRole="admin">
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });

  it("renders children when the array-role gate includes the current role", () => {
    mockMe("head");

    render(
      <IfRole forRole={["admin", "head"]}>
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.getByTestId("gated")).toBeVisible();
  });

  it("renders nothing when the array-role gate excludes the current role", () => {
    mockMe("lead");

    render(
      <IfRole forRole={["admin", "head"]}>
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });
});
