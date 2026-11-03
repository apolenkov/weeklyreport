// @vitest-environment jsdom

import { afterEach, beforeEach, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/reports/report-1",
  replace: vi.fn(),
  push: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

beforeEach(() => {
  navigation.pathname = "/reports/report-1";
});

afterEach(() => {
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.searchParams.mockReturnValue(new URLSearchParams());
});
export { navigation };
