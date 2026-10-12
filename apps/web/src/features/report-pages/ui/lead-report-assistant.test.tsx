import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { reportAssistantOutcomeSchema } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SessionContext,
  type SessionUser,
} from "../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
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

function renderAssistant(
  availability:
    | "available"
    | "not_configured"
    | "pending"
    | "error"
    | "error_then_available" = "available",
  navigable = false,
) {
  let availabilityAttempts = 0;
  const descriptors = [
    { path: ["leadForm", "assistant"], mutation: true },
    {
      path: ["ai", "availability"],
      query:
        availability === "error" || availability === "error_then_available"
          ? () => {
              if (
                availability === "error_then_available" &&
                availabilityAttempts++ > 0
              ) {
                return { availability: "available" };
              }
              throw new Error("availability failed");
            }
          : availability === "pending"
            ? "pending"
            : { availability },
    },
  ];
  const { proxy, captured } = createMockTRPC(descriptors);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider
          value={{
            user: {
              id: "lead-1",
              name: "Lead",
              email: "lead@example.com",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }
  render(
    <Wrapper>
      {navigable ? <NavigableAssistant /> : <LeadReportAssistant />}
    </Wrapper>,
  );
  const mutation = captured["leadForm.assistant"];
  if (!mutation) throw new Error("Assistant mutation was not registered");
  return mutation;
}

function NavigableAssistant() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? "Navigate away from report" : "Return to report"}
      </button>
      {visible && <LeadReportAssistant />}
    </>
  );
}

async function openAssistant() {
  const trigger = await screen.findByRole("button", {
    name: "Open report chat",
  });
  fireEvent.click(trigger);
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
  it("keeps Chat visible but disabled when AI is not configured", async () => {
    renderAssistant("not_configured");

    const trigger = await screen.findByRole("button", {
      name: "Report chat unavailable",
    });
    const reason =
      "Report chat is unavailable until an administrator configures AI";
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveAccessibleDescription(reason);
    act(() => trigger.focus());
    expect((await screen.findAllByText(reason)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription(reason);
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(reason);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription(reason);
    expect(screen.queryByText("Lead workspace")).not.toBeInTheDocument();

    act(() => trigger.blur());
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAccessibleDescription(reason);
  });

  it("keeps Chat disabled while availability is pending", async () => {
    renderAssistant("pending");

    const trigger = await screen.findByRole("button", {
      name: "Checking report chat availability",
    });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger.querySelector("svg")).toHaveClass(
      "animate-spin",
      "motion-reduce:animate-none",
    );
  });

  it("keeps Chat disabled when availability fails", async () => {
    renderAssistant("error");

    expect(
      await screen.findByRole("button", { name: "Report chat unavailable" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", {
        name: "Retry report chat availability check",
      }),
    ).toBeEnabled();
  });

  it("offers an accessible retry when availability cannot be checked", async () => {
    renderAssistant("error_then_available");
    const retry = await screen.findByRole("button", {
      name: "Retry report chat availability check",
    });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(
      await screen.findByRole("button", { name: "Open report chat" }),
    ).toBeEnabled();
  });

  it("opens a focus-safe Sheet and retains transient state on close", async () => {
    renderAssistant();
    await openAssistant();
    const question = screen.getByRole("textbox", { name: "Your question" });
    expect(question).toHaveClass("border-[var(--color-border)]");
    expect(
      screen.getByText(
        /This exchange stays in memory.*Reloading, signing out, or switching accounts clears it\./u,
      ),
    ).toBeInTheDocument();
    fireEvent.change(question, { target: { value: "A temporary question" } });
    // R66: the dismiss control is a full-size touch target, not a bare glyph.
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "size-11",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Report chat" })).toBeNull(),
    );
    await openAssistant();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "A temporary question",
    );
  });

  it("renders grounded Markdown safely and links only authorized sources", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue(successOutcome);
    await openAssistant();
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

  it("renders repeated Markdown lines and inline segments without duplicate keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());

    render(
      <LeadReportAssistantMarkdown
        markdown={"Repeated\nRepeated\n\n\nSame **bold** Same"}
      />,
    );

    expect(
      consoleError.mock.calls.some((call) =>
        call.some((value) => String(value).includes("same key")),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it.each([4, 5, 6] as const)(
    "preserves original H%d answer headings and semantic bullets through Chat",
    async (level) => {
      const mutation = renderAssistant();
      const heading = `Depth ${level}`;
      const answerMarkdown = [
        "# Overview",
        "## Details",
        "### Note",
        `${"#".repeat(level)} ${heading}`,
        "- First",
        "* Second",
      ].join("\n");
      mutation.mutationFn.mockResolvedValueOnce(
        reportAssistantOutcomeSchema.parse({
          ...successOutcome,
          answerMarkdown,
        }),
      );
      const dialog = await openAssistant();
      submitQuestion();

      expect(
        await within(dialog).findByRole("heading", {
          level: 1,
          name: "Overview",
        }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { level: 2, name: "Details" }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { level: 3, name: "Note" }),
      ).toBeInTheDocument();
      expect(
        within(within(dialog).getByRole("list")).getAllByRole("listitem"),
      ).toHaveLength(2);
      expect(
        within(dialog).getByRole("heading", { level, name: heading }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    { markdown: "a **b", visible: "a **b", bold: [] },
    { markdown: "a **b** c", visible: "a b c", bold: ["b"] },
    {
      markdown: "**one** and **two** then **tail",
      visible: "one and two then **tail",
      bold: ["one", "two"],
    },
    { markdown: "**", visible: "**", bold: [] },
  ])(
    "keeps unmatched emphasis literal in Chat: $markdown",
    async ({ markdown, visible, bold }) => {
      const mutation = renderAssistant();
      mutation.mutationFn.mockResolvedValueOnce(
        reportAssistantOutcomeSchema.parse({
          ...successOutcome,
          answerMarkdown: markdown,
        }),
      );
      const dialog = await openAssistant();
      submitQuestion();

      await within(dialog).findByRole("link", { name: /S1.*Week 31.*Portal/u });
      expect(
        Array.from(
          dialog.querySelectorAll("p"),
          (element) => element.textContent,
        ),
      ).toContain(visible);
      expect(
        Array.from(
          dialog.querySelectorAll("strong"),
          (element) => element.textContent,
        ),
      ).toEqual(bold);
    },
  );

  it("uses the shared mobile touch target for assistant submit", async () => {
    renderAssistant();
    await openAssistant();

    expect(
      screen.getByRole("button", { name: "Ask report chat" }),
    ).toHaveAttribute("data-size", "touch");
  });

  it("resubmits the original question plus the selected clarification token", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn
      .mockResolvedValueOnce({
        kind: "clarification_required",
        options: [{ label: "CRM Portal", token: "token-crm" }],
      })
      .mockResolvedValueOnce(successOutcome)
      .mockResolvedValueOnce(successOutcome);
    await openAssistant();
    submitQuestion("What changed in CRM?");

    fireEvent.click(await screen.findByRole("button", { name: "CRM Portal" }));
    await screen.findByText("The release is on track.");
    expect(mutation.calls).toEqual([
      { question: "What changed in CRM?", resolutionTokens: [] },
      { question: "What changed in CRM?", resolutionTokens: ["token-crm"] },
    ]);

    submitQuestion("What is blocked in ERP?");
    await waitFor(() => expect(mutation.calls).toHaveLength(3));
    expect(mutation.calls[2]).toEqual({
      question: "What is blocked in ERP?",
      resolutionTokens: [],
    });
  });

  it("clears the exchange when the authenticated user changes", async () => {
    let currentUser: SessionUser = {
      id: "lead-1",
      name: "Lead",
      email: "lead@example.com",
      role: "lead",
    };
    const descriptors = [
      { path: ["leadForm", "assistant"], mutation: true },
      { path: ["ai", "availability"], query: { availability: "available" } },
    ];
    const { proxy, captured } = createMockTRPC(descriptors);
    const mutation = captured["leadForm.assistant"];
    if (!mutation) throw new Error("Assistant mutation was not registered");
    mutation.mutationFn.mockResolvedValue(successOutcome);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <SessionContext.Provider
            value={{
              user: currentUser,
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            <TRPCProxyContext.Provider value={proxy}>
              <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
            </TRPCProxyContext.Provider>
          </SessionContext.Provider>
        </QueryClientProvider>
      );
    }
    const { rerender } = render(
      <Wrapper>
        <LeadReportAssistant />
      </Wrapper>,
    );

    await openAssistant();
    submitQuestion("Lead one's private question");
    await screen.findByText("The release is on track.");

    currentUser = { ...currentUser, id: "lead-2" };
    rerender(
      <Wrapper>
        <LeadReportAssistant />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(
        screen.queryByText("The release is on track."),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Lead one's private question")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "",
    );
  });

  it("keeps the new user's exchange empty when a pending answer resolves after switching accounts", async () => {
    let currentUser: SessionUser = {
      id: "lead-1",
      name: "Lead",
      email: "lead@example.com",
      role: "lead",
    };
    const descriptors = [
      { path: ["leadForm", "assistant"], mutation: true },
      { path: ["ai", "availability"], query: { availability: "available" } },
    ];
    const { proxy, captured } = createMockTRPC(descriptors);
    const mutation = captured["leadForm.assistant"];
    if (!mutation) throw new Error("Assistant mutation was not registered");
    let resolveRequest: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveRequest = resolve;
    });
    mutation.mutationFn.mockReturnValueOnce(pending);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <SessionContext.Provider
            value={{
              user: currentUser,
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            <TRPCProxyContext.Provider value={proxy}>
              <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
            </TRPCProxyContext.Provider>
          </SessionContext.Provider>
        </QueryClientProvider>
      );
    }
    const { rerender } = render(
      <Wrapper>
        <LeadReportAssistant />
      </Wrapper>,
    );

    await openAssistant();
    submitQuestion("Lead one's pending question");
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing");

    currentUser = { ...currentUser, id: "lead-2" };
    rerender(
      <Wrapper>
        <LeadReportAssistant />
      </Wrapper>,
    );

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "",
    );
    expect(
      screen.getByRole("button", { name: "Ask report chat" }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.(successOutcome);
      await pending;
    });

    expect(screen.queryByText("The release is on track.")).toBeNull();
    expect(screen.queryByText("Lead one's pending question")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /S1.*Week 31.*Portal/u }),
    ).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "",
    );
  });

  it("completes a pending exchange while the assistant surface is unmounted", async () => {
    const mutation = renderAssistant("available", true);
    let resolveRequest: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveRequest = resolve;
    });
    mutation.mutationFn.mockReturnValueOnce(pending);
    await openAssistant();
    submitQuestion("What changed while I navigate?");

    fireEvent.click(screen.getByText("Navigate away from report"));
    expect(
      screen.queryByRole("button", { name: "Open report chat" }),
    ).toBeNull();

    await act(async () => {
      resolveRequest?.(successOutcome);
      await pending;
    });
    fireEvent.click(screen.getByRole("button", { name: "Return to report" }));
    await openAssistant();

    expect(
      await screen.findByText("The release is on track."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask report chat" }),
    ).toBeEnabled();
  });

  it("preserves clarification state when the request fails before retry", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn
      .mockResolvedValueOnce({
        kind: "clarification_required",
        options: [{ label: "CRM Portal", token: "token-crm" }],
      })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(successOutcome);
    await openAssistant();
    submitQuestion("What changed in CRM?");

    fireEvent.click(await screen.findByRole("button", { name: "CRM Portal" }));
    expect(
      await screen.findByText("The assistant could not complete that search."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("The release is on track.");

    expect(mutation.calls).toEqual([
      { question: "What changed in CRM?", resolutionTokens: [] },
      { question: "What changed in CRM?", resolutionTokens: ["token-crm"] },
      { question: "What changed in CRM?", resolutionTokens: ["token-crm"] },
    ]);
  });

  it("retries provider unavailability with the submitted question and tokens", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn
      .mockResolvedValueOnce({
        kind: "clarification_required",
        options: [{ label: "CRM Portal", token: "token-crm" }],
      })
      .mockResolvedValueOnce({ kind: "provider_unavailable" })
      .mockResolvedValueOnce(successOutcome);
    await openAssistant();
    submitQuestion("What changed in CRM?");

    fireEvent.click(await screen.findByRole("button", { name: "CRM Portal" }));
    expect(
      await screen.findByText(/AI service is temporarily unavailable/u),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("The release is on track.");

    expect(mutation.calls).toEqual([
      { question: "What changed in CRM?", resolutionTokens: [] },
      { question: "What changed in CRM?", resolutionTokens: ["token-crm"] },
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
    await openAssistant();
    submitQuestion();
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing");
    const spinners = document.querySelectorAll(".animate-spin");
    expect(spinners).toHaveLength(2);
    for (const spinner of spinners) {
      expect(spinner).toHaveClass("motion-reduce:animate-none");
    }
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

  it("keeps a newer draft question when an earlier request succeeds", async () => {
    const mutation = renderAssistant();
    let resolveRequest: ((value: unknown) => void) | undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveRequest = resolve;
    });
    mutation.mutationFn.mockReturnValueOnce(pending);
    await openAssistant();
    submitQuestion("First question");
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), {
      target: { value: "New draft question" },
    });

    await act(async () => {
      resolveRequest?.(successOutcome);
      await pending;
    });
    await screen.findByText("The release is on track.");
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(
      "New draft question",
    );
  });

  it.each([
    ["semantic_index_pending", "The semantic index is still catching up."],
    ["provider_unavailable", "AI service is temporarily unavailable"],
    ["provider_response_incomplete", "stopped before it finished the answer"],
    ["no_results", "No matching report records were found"],
    ["result_set_too_large", "matches too many records"],
    ["invalid_plan", "safe report search"],
    ["ai_not_configured", "not configured yet"],
  ] as const)("renders the %s product state", async (kind, message) => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue({ kind });
    await openAssistant();
    submitQuestion();
    expect(
      await screen.findByText(new RegExp(message, "u")),
    ).toBeInTheDocument();
  });

  it.each([
    ["invalid_plan", "Edit question"],
    ["no_results", "Ask another question"],
    ["result_set_too_large", "Narrow question"],
  ] as const)(
    "returns focus to the editor for the %s outcome without retrying",
    async (kind, actionLabel) => {
      const mutation = renderAssistant();
      mutation.mutationFn.mockResolvedValue({ kind });
      await openAssistant();
      submitQuestion("Original question");

      const action = await screen.findByRole("button", { name: actionLabel });
      fireEvent.click(action);

      expect(
        screen.getByRole("textbox", { name: "Your question" }),
      ).toHaveFocus();
      expect(mutation.calls).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    },
  );

  it("returns to editing instead of blind retry when AI is not configured", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue({ kind: "ai_not_configured" });
    await openAssistant();
    submitQuestion();

    expect(
      await screen.findByText(/administrator must configure AI/iu),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit question" }));
    expect(
      screen.getByRole("textbox", { name: "Your question" }),
    ).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(mutation.calls).toHaveLength(1);
  });

  it("explains provider throttling instead of blaming the connection", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn.mockResolvedValue({
      kind: "provider_unavailable",
      rateLimit: { retryAfterSeconds: 42 },
    });
    await openAssistant();
    submitQuestion();

    expect(
      await screen.findByText(/rate limit.*42 seconds/iu),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Check your connection/iu),
    ).not.toBeInTheDocument();
  });

  it("renders resource limits with singular/plural retry wording and retries", async () => {
    const mutation = renderAssistant();
    mutation.mutationFn
      .mockResolvedValueOnce({
        kind: "resource_limited",
        retryAfterSeconds: 1,
      })
      .mockResolvedValueOnce({
        kind: "resource_limited",
        retryAfterSeconds: 2,
      })
      .mockResolvedValueOnce(successOutcome);
    await openAssistant();
    submitQuestion();

    expect(
      await screen.findByText(/busy\. Try again in about 1 second\./u),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText(/busy\. Try again in about 2 seconds\./u),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("The release is on track."),
    ).toBeInTheDocument();
  });
});
