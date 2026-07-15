import type { WeeklyPortfolioProduct } from "../../../features/report-sections/model/weekly-report-types";
import {
  BORDER_LIGHT,
  printStatusColor,
  printStatusLabel,
  TEXT_SECONDARY,
} from "./print-report-theme";

interface PrintPortfolioTableProps {
  readonly products: readonly WeeklyPortfolioProduct[];
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
      <thead>
        <tr style={{ backgroundColor: "#1E3932", color: "#ffffff" }}>
          <th style={{ padding: "6px 8px", textAlign: "left" }}>Product</th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "80px" }}
          >
            Status
          </th>
          <th style={{ padding: "6px 8px", textAlign: "left" }}>Leads</th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "60px" }}
          >
            This Week
          </th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "60px" }}
          >
            Next Week
          </th>
          <th
            style={{ padding: "6px 8px", textAlign: "center", width: "50px" }}
          >
            Risks
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id} style={{ borderBottom: BORDER_LIGHT }}>
            <td style={{ padding: "5px 8px", fontWeight: 600 }}>
              {product.name}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "50px",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: printStatusColor(product.status),
                }}
              >
                {printStatusLabel(product.status)}
              </span>
            </td>
            <td style={{ padding: "5px 8px", color: TEXT_SECONDARY }}>
              {product.leads}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {product.currentWeekCount}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {product.nextWeekCount}
            </td>
            <td style={{ padding: "5px 8px", textAlign: "center" }}>
              {product.riskCount > 0 ? (
                <span style={{ color: "#c82014", fontWeight: 600 }}>
                  {product.riskCount}
                </span>
              ) : (
                <span style={{ color: "rgba(0,0,0,0.38)" }}>0</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
