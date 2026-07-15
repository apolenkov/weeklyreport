import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { MockProduct, MockUser } from "../model/admin-types";
import { ProductsTab } from "./products-tab";

// ----- mocks ---------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock heavy child components so their own queries don't pollute the
// environment. We stub them with lightweight divs that preserve any
// data-testid attributes the parent tree might depend on.
vi.mock("./product-group-chips", () => ({
  ProductGroupChips: () => <div data-testid="product-group-chips-stub" />,
}));

vi.mock("./stage-assignment-editor", () => ({
  StageAssignmentEditor: () => (
    <div data-testid="stage-assignment-editor-stub" />
  ),
}));

vi.mock("../../../shared/ui/search-input", () => ({
  SearchInput: () => <div data-testid="search-input-stub" />,
}));

vi.mock("../../../shared/ui/confirm-delete-dialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    onCancel,
  }: {
    readonly open: boolean;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// ----- fixtures ------------------------------------------------------

const LEAD_ID = "u-lead-1";
const PRODUCT_ID = "p-product-1";
const SECOND_PRODUCT_ID = "p-product-2";

const mockLead: MockUser = {
  id: LEAD_ID,
  name: "Alice",
  lastName: "Alice",
  firstName: "Lead",
  middleName: null,
  position: null,
  email: "alice@example.com",
  role: "lead",
  groupId: "g1",
  department: "Engineering",
  isActive: true,
};

const mockProduct: MockProduct = {
  id: PRODUCT_ID,
  name: "Test Product",
  leadOwnerId: LEAD_ID,
  stages: [],
  status: "active",
};

const secondProduct: MockProduct = {
  ...mockProduct,
  id: SECOND_PRODUCT_ID,
  name: "Second Product",
};

// ----- tRPC test double ----------------------------------------------

function renderTab(opts?: {
  products?: MockProduct[];
  users?: MockUser[];
  productFilter?: string | null;
}) {
  const { proxy } = createMockTRPC([
    {
      path: ["admin", "listStageAssignmentCounts"],
      query: [] as unknown[],
    },
    { path: ["admin", "saveProject"], mutation: true },
    { path: ["admin", "deleteProject"], mutation: true },
    // Minimal stubs for other admin paths that invalidateAdmin may touch.
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(
    <ProductsTab
      products={opts?.products ?? [mockProduct]}
      users={opts?.users ?? [mockLead]}
      productFilter={opts?.productFilter ?? null}
    />,
    { wrapper: Wrapper },
  );
}

// ----- tests ---------------------------------------------------------

describe("ProductsTab — deep-link panel state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-expands the deep-linked product on initial load", () => {
    renderTab({ productFilter: PRODUCT_ID });

    expect(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("stage-assignment-editor-stub"),
    ).toBeInTheDocument();
  });

  it("keeps a manually collapsed deep-linked product closed after a refetch", async () => {
    const user = userEvent.setup();
    const products = [mockProduct];
    const { rerender } = renderTab({ products, productFilter: PRODUCT_ID });

    await user.click(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    );

    rerender(
      <ProductsTab
        products={products.map((product) => ({ ...product }))}
        users={[mockLead]}
        productFilter={PRODUCT_ID}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Expand stage assignments for ${mockProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("stage-assignment-editor-stub"),
    ).not.toBeInTheDocument();
  });

  it("auto-expands and guards a genuinely new deep-link target", async () => {
    const user = userEvent.setup();
    const products = [mockProduct, secondProduct];
    const { rerender } = renderTab({ products, productFilter: PRODUCT_ID });

    await user.click(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${mockProduct.name}`,
      }),
    );
    rerender(
      <ProductsTab
        products={products}
        users={[mockLead]}
        productFilter={SECOND_PRODUCT_ID}
      />,
    );

    const secondProductToggle = screen.getByRole("button", {
      name: `Collapse stage assignments for ${secondProduct.name}`,
    });
    expect(secondProductToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(secondProductToggle);
    rerender(
      <ProductsTab
        products={products.map((product) => ({ ...product }))}
        users={[mockLead]}
        productFilter={SECOND_PRODUCT_ID}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Expand stage assignments for ${secondProduct.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ProductsTab — Add/Edit dialog a11y (VA-0a high unit-rtl)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escape keydown on document closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    // Open the dialog via the «Add Product» button.
    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Fire Escape on the document — the useEffect listener should close it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel button click closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking the backdrop (role=presentation) closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The backdrop is the outer div with role="presentation".
    await user.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking inside the dialog (role=dialog) does NOT close it (stopPropagation)", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Click the inner dialog container itself — stopPropagation should
    // prevent the backdrop onClick from firing.
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// admin-dialog-focus-management (autofocus-admin-dialogs)
describe("ProductsTab — focus management (autofocus-admin-dialogs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("product-name input receives focus when the dialog opens (autoFocus)", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    const input = screen.getByLabelText(/product name/i);
    // React honours autoFocus on conditionally-mounted elements in jsdom;
    // dropping the autoFocus wiring in production code fails this assert.
    expect(input).toHaveFocus();
  });

  it("focus returns to the trigger button after the dialog closes via Cancel", async () => {
    const user = userEvent.setup();
    renderTab();

    const addBtn = screen.getByRole("button", { name: /add new product/i });
    addBtn.focus();
    await user.click(addBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });

  it("focus returns to the trigger button after the dialog closes via Escape", async () => {
    const user = userEvent.setup();
    renderTab();

    const addBtn = screen.getByRole("button", { name: /add new product/i });
    addBtn.focus();
    await user.click(addBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });
});

describe("ProductsTab — slide-capacity advisory (add-slide-capacity-signals)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function ownedProducts(n: number): MockProduct[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `p-${String(i)}`,
      name: `Product ${String(i)}`,
      leadOwnerId: LEAD_ID,
      stages: [],
      status: "active" as const,
    }));
  }

  it("shows the over-capacity advisory at the recommended max; Save stays enabled", async () => {
    const user = userEvent.setup();
    renderTab({ products: ownedProducts(6) });

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Product" })).toBeEnabled();
  });

  it("shows no over-capacity advisory below the recommended ceiling", async () => {
    const user = userEvent.setup();
    renderTab({ products: ownedProducts(3) });

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "3 of 6 products",
    );
    expect(
      screen.queryByTestId("lead-product-overcap"),
    ).not.toBeInTheDocument();
  });

  it("counts the lead's products from the FULL set, not a filtered view (F8)", async () => {
    const user = userEvent.setup();
    // productFilter narrows the visible list to a single product…
    renderTab({ products: ownedProducts(6), productFilter: "p-0" });

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    // …but the advisory still counts all six products the lead owns.
    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
  });
});
