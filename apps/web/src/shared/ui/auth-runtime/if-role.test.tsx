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
    useQueryMock.mockReturnValue({ data: null, isPending: false });
    return;
  }
  useQueryMock.mockReturnValue({
    data: {
      userId: "00000000-0000-4000-8000-000000000001",
      name: "Test User",
      email: "test@weeklyreport.local",
      role,
    },
    isPending: false,
  });
}

describe("IfRole — role-guard wrapper", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("renders nothing while auth.me is still loading (no data yet)", () => {
    useQueryMock.mockReturnValue({ data: undefined, isPending: true });

    render(
      <IfRole forRole="admin">
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });

  it("renders the loadingFallback while auth.me is pending", () => {
    useQueryMock.mockReturnValue({ data: undefined, isPending: true });

    render(
      <IfRole
        forRole="admin"
        loadingFallback={<span data-testid="placeholder">loading</span>}
      >
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.getByTestId("placeholder")).toBeVisible();
    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
  });

  it("does not render the loadingFallback once auth.me has loaded", () => {
    mockMe("admin");

    render(
      <IfRole
        forRole="admin"
        loadingFallback={<span data-testid="placeholder">loading</span>}
      >
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.getByTestId("gated")).toBeVisible();
    expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
  });

  it("does not render the loadingFallback when the role gate excludes a loaded session", () => {
    mockMe("head");

    render(
      <IfRole
        forRole="admin"
        loadingFallback={<span data-testid="placeholder">loading</span>}
      >
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("gated")).not.toBeInTheDocument();
    expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
  });

  it("does not render the loadingFallback when auth.me errored", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });

    render(
      <IfRole
        forRole="admin"
        loadingFallback={<span data-testid="placeholder">loading</span>}
      >
        <span data-testid="gated">visible</span>
      </IfRole>,
    );

    expect(screen.queryByTestId("placeholder")).not.toBeInTheDocument();
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
