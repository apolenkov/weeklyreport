import { Toaster } from "@customreport/ui/components/ui/sonner";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sonnerMocks = vi.hoisted(() => ({
  props: vi.fn<(props: Record<string, unknown>) => void>(),
}));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerMocks.props(props);
    return null;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Toaster", () => {
  it("uses the success tokens for rich-color toast contrast", () => {
    render(<Toaster richColors />);

    expect(sonnerMocks.props).toHaveBeenCalledOnce();
    const props = sonnerMocks.props.mock.calls[0]?.[0];
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.richColors).toBe(true);
    expect(props.theme).toBe("light");
    expect(props.style).toEqual(
      expect.objectContaining({
        "--success-bg": "var(--color-success)",
        "--success-border": "var(--color-success-foreground)",
        "--success-text": "var(--color-success-foreground)",
      }),
    );
  });
});
