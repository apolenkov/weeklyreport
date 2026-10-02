// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// notFound() throws in Next; the mock must too, or execution would fall
// through to the gated component.
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
);
const productFeedbackEnabled = vi.hoisted(() => vi.fn());
const productFeedbackPageMock = vi.hoisted(() =>
  vi.fn(() => <div data-testid="product-feedback-page" />),
);

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("../../../shared/lib/runtime/web-env", () => ({
  webEnv: { productFeedback: productFeedbackEnabled },
}));
vi.mock("../../../features/product-feedback", () => ({
  ProductFeedbackPage: productFeedbackPageMock,
}));

import FeedbackPage from "./page";

describe("FeedbackPage — product-feedback flag gate", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    productFeedbackEnabled.mockReset();
    productFeedbackPageMock.mockClear();
  });

  it("renders the feedback inbox when the flag is on", () => {
    productFeedbackEnabled.mockReturnValue(true);

    render(<FeedbackPage />);

    expect(screen.getByTestId("product-feedback-page")).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("calls notFound and renders nothing when the flag is off", () => {
    productFeedbackEnabled.mockReturnValue(false);

    expect(() => render(<FeedbackPage />)).toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(notFoundMock).toHaveBeenCalled();
    expect(productFeedbackPageMock).not.toHaveBeenCalled();
  });
});
