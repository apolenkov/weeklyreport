import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import { ProductsTab } from "./products-tab";

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

vi.mock("./stage-assignments/stage-assignment-editor", () => ({
  StageAssignmentEditor: () => (
    <div data-testid="stage-assignment-editor-stub" />
  ),
}));

vi.mock("../../../shared/ui/search/search-input", () => ({
  SearchInput: () => <div data-testid="search-input-stub" />,
}));

vi.mock("../../../shared/ui/dialogs/confirm-delete-dialog", () => ({
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

const LEAD_ID = "u-lead-1";
const PRODUCT_ID = "p-product-1";
const SECOND_PRODUCT_ID = "p-product-2";

const mockLead: AdminUserView = {
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

const mockProduct: AdminProductView = {
  id: PRODUCT_ID,
  name: "Test Product",
  leadOwnerId: LEAD_ID,
  stages: [],
  status: "active",
};

const secondProduct: AdminProductView = {
  ...mockProduct,
  id: SECOND_PRODUCT_ID,
  name: "Second Product",
};

function renderTab(opts?: {
  products?: AdminProductView[];
  users?: AdminUserView[];
  productFilter?: string | null;
  countsError?: boolean;
}) {
  const { proxy } = createMockTRPC([
    {
      path: ["admin", "listStageAssignmentCounts"],
      query: opts?.countsError
        ? Promise.reject(new Error("counts failed"))
        : ([] as unknown[]),
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

describe("ProductsTab — Add/Edit dialog a11y", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escape keydown on document closes the Add/Edit dialog", async () => {
    const user = userEvent.setup();
    renderTab();

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

describe("ProductsTab — focus management", () => {
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

function openAddAndPickLead() {
  const addBtn = screen.getByRole("button", { name: /add new product/i });
  fireEvent.click(addBtn);
  fireEvent.change(screen.getByLabelText(/lead owner/i), {
    target: { value: LEAD_ID },
  });
  fireEvent.change(screen.getByLabelText(/product name/i), {
    target: { value: "New Product" },
  });
}

describe("ProductsTab — slide-capacity advisory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function ownedProducts(n: number): AdminProductView[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `p-${String(i)}`,
      name: `Product ${String(i)}`,
      leadOwnerId: LEAD_ID,
      stages: [],
      status: "active" as const,
    }));
  }

  it("shows the over-capacity advisory at the recommended max; Save stays enabled once a lead is chosen", () => {
    renderTab({ products: ownedProducts(6) });

    openAddAndPickLead();

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Product" })).toBeEnabled();
  });

  it("starts the add dialog with no preselected owner and blocks save until one is chosen", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: /add new product/i }));

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "New Product" },
    });

    // The owner select is unselected — an accidental save cannot bind the new
    // product to the first lead on the list even though the name is filled.
    expect(screen.getByLabelText(/lead owner/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add Product" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/lead owner/i), {
      target: { value: LEAD_ID },
    });
    expect(screen.getByRole("button", { name: "Add Product" })).toBeEnabled();
  });

  it("shows no over-capacity advisory below the recommended ceiling", () => {
    renderTab({ products: ownedProducts(3) });

    openAddAndPickLead();

    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "3 of 6 products",
    );
    expect(
      screen.queryByTestId("lead-product-overcap"),
    ).not.toBeInTheDocument();
  });

  it("counts the lead's products from the FULL set, not a filtered view", () => {
    // productFilter narrows the visible list to a single product…
    renderTab({ products: ownedProducts(6), productFilter: "p-0" });

    openAddAndPickLead();

    // …but the advisory still counts all six products the lead owns.
    expect(screen.getByTestId("lead-product-count")).toHaveTextContent(
      "6 of 6 products",
    );
    expect(screen.getByTestId("lead-product-overcap")).toBeInTheDocument();
  });

  it("surfaces the stage-count query failure instead of showing zero counts", async () => {
    renderTab({ countsError: true });

    expect(
      await screen.findByText(/Could not load stage assignment counts/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\/7 stages/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Stages unavailable").length).toBeGreaterThan(0);
  });
});
