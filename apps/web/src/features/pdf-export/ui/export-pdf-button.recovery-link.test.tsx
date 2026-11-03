// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ExportPdfButton } from "./export-pdf-button";

const handleExport = vi.fn();
vi.mock("./use-pdf-export-job", () => ({
  usePdfExportJob: () => ({
    isExportable: true,
    isGenerating: false,
    disabled: false,
    fallbackUrl: null,
    recoveryRequired: true,
    handleExport,
  }),
}));

it("links to PDF exports without requesting a new export", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportPdfButton reportId="report" periodStatus="published" />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Recovery required");
  expect(
    screen.getByRole("link", { name: "Open PDF exports" }),
  ).toHaveAttribute("href", "/pdf-exports");
  expect(handleExport).not.toHaveBeenCalled();
});
