/**
 * @vitest-environment jsdom
 *
 * Regression tests for packages/ui/src/components/data-table.tsx
 *
 * Catalog: openspec/changes/verify-a11y-recommended-flip/design.md
 * Section: `packages/ui/src/components/data-table.tsx`
 *
 * In-scope rows (unit-rtl high + snapshot):
 *   - TableRow key={index} with biome-ignore comment (unit-rtl, high)
 *   - sortedData.map body with comment preserved (unit-rtl, high)
 *   - DOM snapshot of table rows with comment (snapshot, high)
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTable, type Column } from "./data-table";

// Tell React's act() that we are in a test environment so it can flush
// effects synchronously and suppress the "not configured to support act"
// warning. The global is defined by React's types in react-dom/test-utils
// but exposed on globalThis in test environments.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean; // required by React's act() test environment detection
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimpleRow {
  id: number;
  name: string;
  value: string;
}

const COLUMNS: Column<SimpleRow>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "value", header: "Value" },
];

const ROWS: SimpleRow[] = [
  { id: 1, name: "Alpha", value: "a" },
  { id: 2, name: "Beta", value: "b" },
  { id: 3, name: "Gamma", value: "c" },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderTable(
  data: SimpleRow[] = ROWS,
  onRowClick?: (row: SimpleRow) => void,
): void {
  act(() => {
    root.render(
      <DataTable
        columns={COLUMNS}
        data={data}
        onRowClick={onRowClick}
        aria-label="test table"
      />,
    );
  });
}

// ---------------------------------------------------------------------------
// Row 1: TableRow key={index} — renders without error or missing key warning
//
// The catalog notes that the biome-ignore comment (now eslint-disable-next-line)
// on the TableRow suppresses the no-array-index-key rule. The assertion is that
// rows render without React key-related errors and the DOM is populated.
// ---------------------------------------------------------------------------

describe("DataTable — TableRow key={index} (unit-rtl, high)", () => {
  it("renders each data row as a <tr> element in the table body", () => {
    renderTable();
    const rows = container.querySelectorAll(
      "[data-slot='table-body'] tr[data-slot='table-row']",
    );
    expect(rows).toHaveLength(ROWS.length);
  });

  it("renders rows with duplicate data without deduplication (index key is used)", () => {
    const dupes: SimpleRow[] = [
      { id: 1, name: "Same", value: "x" },
      { id: 1, name: "Same", value: "x" },
    ];
    renderTable(dupes);
    const rows = container.querySelectorAll(
      "[data-slot='table-body'] tr[data-slot='table-row']",
    );
    // Both rows must appear — index key ensures no React deduplication
    expect(rows).toHaveLength(2);
  });

  it("no console.error is called during render (no React key warning)", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op spy
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderTable();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Row 2: sortedData.map body — each row renders data in correct order
//
// The catalog asserts that each row in the table body renders the data from
// the sorted array in the correct order. With no sort active the display order
// matches the input order.
// ---------------------------------------------------------------------------

describe("DataTable — sortedData.map body (unit-rtl, high)", () => {
  it("renders cell content matching input data in order", () => {
    renderTable();
    const cells = Array.from(
      container.querySelectorAll(
        "[data-slot='table-body'] td[data-slot='table-cell']",
      ),
    );
    // 3 rows × 3 columns = 9 cells; verify first row matches ROWS[0]
    expect(cells.at(0)?.textContent).toBe("1");
    expect(cells.at(1)?.textContent).toBe("Alpha");
    expect(cells.at(2)?.textContent).toBe("a");
  });

  it("renders all rows with the correct number of cells per row", () => {
    renderTable();
    const tbodyRows = container.querySelectorAll(
      "[data-slot='table-body'] tr[data-slot='table-row']",
    );
    tbodyRows.forEach((row) => {
      const cells = row.querySelectorAll("td[data-slot='table-cell']");
      expect(cells).toHaveLength(COLUMNS.length);
    });
  });

  it("renders an empty-state message when data is an empty array", () => {
    renderTable([]);
    const tbody = container.querySelector("[data-slot='table-body']");
    expect(tbody).not.toBeNull();
    expect(tbody?.textContent).toContain("No data yet");
    // Exactly one row: the "no data" row (no data rows present)
    const rows = container.querySelectorAll(
      "[data-slot='table-body'] tr[data-slot='table-row']",
    );
    expect(rows).toHaveLength(1);
  });

  it("renders custom cell renderer output when column.cell is provided", () => {
    const customColumns: Column<SimpleRow>[] = [
      {
        key: "name",
        header: "Name",
        cell: (row) => <strong data-testid="custom-cell">{row.name}</strong>,
      },
    ];
    act(() => {
      root.render(
        <DataTable columns={customColumns} data={ROWS} aria-label="custom" />,
      );
    });
    const customCells = Array.from(
      container.querySelectorAll("[data-testid='custom-cell']"),
    );
    expect(customCells).toHaveLength(ROWS.length);
    expect(customCells.at(0)?.textContent).toBe("Alpha");
  });
});

// ---------------------------------------------------------------------------
// Row 3: DOM snapshot of table rows with comment (snapshot, high)
//
// The catalog asserts that the DOM structure, class names, and all attributes
// on TableRow remain unchanged from before the eslint-disable comment addition.
// A snapshot pins the exact structure — any future accidental change will fail
// this test.
// ---------------------------------------------------------------------------

describe("DataTable — DOM snapshot (snapshot, high)", () => {
  it("table body rows match snapshot", () => {
    renderTable();
    const tbody = container.querySelector("[data-slot='table-body']");
    expect(tbody).not.toBeNull();
    expect(tbody?.innerHTML).toMatchSnapshot();
  });

  it("full table structure matches snapshot", () => {
    renderTable();
    expect(container.innerHTML).toMatchSnapshot();
  });
});
