import type { WeeklyPortfolioProduct } from "../../../features/report-sections/model/weekly-report-types";
import { statusLabel } from "../../../lib/status-presentation";
import {
  BORDER_LIGHT,
  BRAND_DARK_SURFACE,
  ON_BRAND_TEXT,
  printStatusColor,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from "./print-report-theme";

interface PrintPortfolioTableProps {
  readonly products: readonly WeeklyPortfolioProduct[];
}

const PORTFOLIO_HEAD_CENTERED_STYLE = {
  padding: "6px 8px",
  textAlign: "center",
} as const;
const PORTFOLIO_ROW_CENTERED_STYLE = {
  padding: "5px 8px",
  textAlign: "center",
} as const;

function PrintPortfolioHead() {
  return (
    <thead>
      <tr
        style={{
          backgroundColor: BRAND_DARK_SURFACE,
          color: ON_BRAND_TEXT,
        }}
      >
        <th style={{ padding: "6px 8px", textAlign: "left" }}>Product</th>
        <th style={{ ...PORTFOLIO_HEAD_CENTERED_STYLE, width: "80px" }}>
          Status
        </th>
        <th style={{ padding: "6px 8px", textAlign: "left" }}>Leads</th>
        <th style={{ ...PORTFOLIO_HEAD_CENTERED_STYLE, width: "60px" }}>
          This Week
        </th>
        <th style={{ ...PORTFOLIO_HEAD_CENTERED_STYLE, width: "60px" }}>
          Next Week
        </th>
        <th style={{ ...PORTFOLIO_HEAD_CENTERED_STYLE, width: "50px" }}>
          Risks
        </th>
      </tr>
    </thead>
  );
}

function PrintPortfolioRow({
  product,
}: {
  readonly product: WeeklyPortfolioProduct;
}) {
  return (
    <tr style={{ borderBottom: BORDER_LIGHT }}>
      <td style={{ padding: "5px 8px", fontWeight: 600 }}>{product.name}</td>
      <td style={PORTFOLIO_ROW_CENTERED_STYLE}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "50px",
            fontSize: "10px",
            fontWeight: 600,
            color: ON_BRAND_TEXT,
            backgroundColor: printStatusColor(product.status),
          }}
        >
          {statusLabel(product.status, "print")}
        </span>
      </td>
      <td style={{ padding: "5px 8px", color: TEXT_SECONDARY }}>
        {product.leads}
      </td>
      <td style={PORTFOLIO_ROW_CENTERED_STYLE}>{product.currentWeekCount}</td>
      <td style={PORTFOLIO_ROW_CENTERED_STYLE}>{product.nextWeekCount}</td>
      <td style={PORTFOLIO_ROW_CENTERED_STYLE}>
        <span
          style={
            product.riskCount > 0
              ? { color: printStatusColor("blocked"), fontWeight: 600 }
              : { color: TEXT_TERTIARY }
          }
        >
          {product.riskCount}
        </span>
      </td>
    </tr>
  );
}

export function PrintPortfolioTable({ products }: PrintPortfolioTableProps) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "11px",
        lineHeight: "1.4",
      }}
    >
      <PrintPortfolioHead />
      <tbody>
        {products.map((product) => (
          <PrintPortfolioRow key={product.id} product={product} />
        ))}
      </tbody>
    </table>
  );
}
