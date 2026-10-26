// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { reviewVerdictInputSchema } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeTRPCProxy } from "../../../shared/lib/trpc/trpc";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { RequestChangesDialog } from "./request-changes-dialog";

const SECTION = "11111111-1111-4111-8111-111111111111";

// The response boundary remains controlled; the real client link decodes the
// same Zod message shape returned by tRPC input validation.
function renderRejectedRequest(reason: string, domainMessage?: string) {
  const command = {
    reportSectionId: SECTION,
    verdict: "changes_requested",
    version: 3,
    comment: reason,
  };
  const parsed = reviewVerdictInputSchema.safeParse(command);
  const message = domainMessage ?? (parsed.success ? "" : parsed.error.message);
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify([
          {
            error: {
              json: {
                message,
                code: domainMessage ? -32_009 : -32_600,
                data: {
                  code: domainMessage ? "CONFLICT" : "BAD_REQUEST",
                  httpStatus: domainMessage ? 409 : 400,
                  path: "review.verdict",
                },
              },
            },
          },
        ]),
        {
          status: domainMessage ? 409 : 400,
          headers: { "content-type": "application/json" },
        },
      ),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const proxy = makeTRPCProxy(client);
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  const onClose = vi.fn();
  render(
    <RequestChangesDialog
      reportSectionId={SECTION}
      version={3}
      subjectName="Ada"
      onClose={onClose}
      onRequested={vi.fn()}
    />,
    { wrapper },
  );
  return { fetcher, onClose, parsed };
}

afterEach(() => vi.unstubAllGlobals());

describe("Request changes rejection through the public tRPC client", () => {
  it("blocks invisible-only input before transport and retains it for correction", async () => {
    const reason = "\u200B\u200C\u200D";
    const { fetcher, onClose, parsed } = renderRejectedRequest(reason);
    expect(parsed.success).toBe(false);
    const field = screen.getByLabelText("Reason for the lead");
    await userEvent.type(field, reason);
    await userEvent.click(
      screen.getByRole("button", { name: "Request changes" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a reason for the lead.",
    );
    expect(screen.getByRole("alert").textContent).not.toContain('"code"');
    expect(field).toHaveValue(reason);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("preserves a meaningful domain conflict and the typed reason", async () => {
    const reason = "  Add a risk owner.  ";
    const message = "The section changed. Refresh and try again.";
    const { fetcher, onClose, parsed } = renderRejectedRequest(reason, message);
    expect(parsed.success).toBe(true);
    const field = screen.getByLabelText("Reason for the lead");
    await userEvent.type(field, reason);
    await userEvent.click(
      screen.getByRole("button", { name: "Request changes" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(field).toHaveValue(reason);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
