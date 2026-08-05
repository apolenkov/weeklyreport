import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { LeadReportAssistant } from "./lead-report-assistant";
import { LeadReportAssistantMarkdown } from "./lead-report-assistant-markdown";
import { LeadReportAssistantStore } from "./lead-report-assistant-store";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

const successOutcome = {
  kind: "ok" as const,
  answerMarkdown: "**The release is on track.** [S1]",
  citations: [
    {
      sourceId: "S1",
      reportId: REPORT_ID,
      periodLabel: "Week 31",
      authorName: "Lead",
      subjectName: "Portal",
      recordKind: "item",
    },
  ],
  metadata: { truncated: false, insufficientEvidence: false },
};

function renderAssistant() {
  const { proxy, captured } = createMockTRPC([
    { path: ["leadForm", "assistant"], mutation: true },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  render(
    <Wrapper>
      <LeadReportAssistant />
    </Wrapper>,
  );
  const mutation = captured["leadForm.assistant"];
  if (!mutation) throw new Error("Assistant mutation was not registered");
  return mutation;
}

function openAssistant() {
  fireEvent.click(screen.getByRole("button", { name: "Open report chat" }));
  return screen.getByRole("dialog", { name: "Report chat" });
}

function submitQuestion(question = "What changed?") {
  fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask report chat" }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("LeadReportAssistant", () => {
  it("opens a focus-safe Sheet and retains transient state on close", async () => {
    renderAssistant();
    openAssistant();
    const question = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(question, { target: { value: "A temporary question" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Report chat" })).toBeNull(),
    );
    openAssistant();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "A temporary question",
    );
  });

  it("renders grounded Markdown safely and links only authorized sources", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue(successOutcome);
    openAssistant();
    submitQuestion();

    expect(
      await screen.findByText("The release is on track."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /S1.*Week 31.*Portal/u }),
    ).toHaveAttribute("href", `/lead/report/${REPORT_ID}`);

    const { container } = render(
      <LeadReportAssistantMarkdown markdown="<script>alert(1)</script>" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("<script>alert(1)</script>");
  });

  it("resubmits the original question plus the selected clarification token", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn
      .mockResolvedValueOnce({
        kind: "clarification_required",
        options: [{ label: "CRM Portal", token: "token-crm" }],
      })
      .mockResolvedValueOnce(successOutcome);
    openAssistant();
    submitQuestion("What changed in CRM?");

    fireEvent.click(await screen.findByRole("button", { name: "CRM Portal" }));
    await screen.findByText("The release is on track.");
    expect(mutation.calls).toEqual([
      { question: "What changed in CRM?", resolutionTokens: [] },
      { question: "What changed in CRM?", resolutionTokens: ["token-crm"] },
    ]);
  });

  it("shows busy state, prevents duplicate submit, and supports retry after errors", async () => {
    const mutation = renderAssistant();
    let resolveFirst: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveFirst = resolve;
    });
    mutation.mutationFn.mockReturnValueOnce(pending);
    openAssistant();
    submitQuestion();
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing");
    expect(
      screen.getByRole("button", { name: "Searching reports" }),
    ).toBeDisabled();
    await act(async () => {
      resolveFirst?.(successOutcome);
      await pending;
    });
    expect(
      await screen.findByText("The release is on track."),
    ).toBeInTheDocument();

    mutation.mutationFn.mockRejectedValueOnce(new Error("network"));
    submitQuestion("Try again");
    expect(
      await screen.findByText("The assistant could not complete that search."),
    ).toBeInTheDocument();
    mutation.mutationFn.mockResolvedValueOnce(successOutcome);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("The release is on track."),
    ).toBeInTheDocument();
  });

  it.each([
    ["semantic_index_pending", "The semantic index is still catching up."],
    ["provider_unavailable", "AI service is temporarily unavailable"],
    ["no_results", "No matching report records were found"],
    ["result_set_too_large", "matches too many records"],
    ["invalid_plan", "safe report search"],
  ] as const)("renders the %s product state", async (kind, message) => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue({ kind });
    openAssistant();
    submitQuestion();
    expect(
      await screen.findByText(new RegExp(message, "u")),
    ).toBeInTheDocument();
  });
});
