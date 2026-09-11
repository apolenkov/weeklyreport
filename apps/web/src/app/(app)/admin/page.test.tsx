// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../features/admin", () => ({
  ADMIN_TAB_LABELS: { users: "Users", products: "Products" },
  ADMIN_TABS: ["users", "products"],
  AdminPanel: ({
    activeTab,
    productFilter,
  }: {
    activeTab: string;
    productFilter: string | null;
  }) => (
    <div
      data-testid="admin-panel"
      data-active-tab={activeTab}
      data-product-filter={productFilter ?? ""}
    />
  ),
  AdminTabsMobileSelect: () => null,
  isAdminTab: (value: string) => ["users", "products"].includes(value),
  JobsTabLabel: () => null,
}));
vi.mock("../../../features/review/ui/reopen-tab-label", () => ({
  ReopenTabLabel: () => null,
}));

import AdminPage from "./page";

async function renderPage(searchParams: {
  tab?: string | string[];
  filter?: string | string[];
}) {
  render(await AdminPage({ searchParams: Promise.resolve(searchParams) }));
  return screen.getByTestId("admin-panel");
}

describe("AdminPage — query parameters", () => {
  it("preserves a scalar product deep link", async () => {
    const panel = await renderPage({ tab: "products", filter: "product-7" });
    expect(panel).toHaveAttribute("data-active-tab", "products");
    expect(panel).toHaveAttribute("data-product-filter", "product-7");
  });

  it("ignores repeated filter values", async () => {
    const panel = await renderPage({
      tab: "products",
      filter: ["product-7", "product-8"],
    });
    expect(panel).toHaveAttribute("data-active-tab", "products");
    expect(panel).toHaveAttribute("data-product-filter", "");
  });
});
