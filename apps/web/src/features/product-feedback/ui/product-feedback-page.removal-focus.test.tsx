// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductFeedbackPage } from "./product-feedback-page";

const { useProductFeedbackInbox } = vi.hoisted(() => ({
  useProductFeedbackInbox: vi.fn(),
}));

vi.mock("../model/use-product-feedback-inbox", () => ({
  useProductFeedbackInbox,
}));
vi.mock("../../../shared/lib/auth/session-provider", () => ({
  useSession: () => ({ user: { role: "admin" } }),
}));

function record(id: string, message: string) {
  return {
    id,
    type: "bug",
    message,
    status: "open",
    url: "/lead/report/report-1",
    authorName: "Lead User",
    authorUserId: "lead-user",
    viewport: "1440x900",
    createdAt: new Date("2026-09-03T08:00:00Z"),
    updatedAt: new Date("2026-09-03T08:00:00Z"),
    annotations: [],
    screenshotUrl: null,
    screenshotRegion: null,
    diagnostics: null,
    source: "legacy",
    capabilities: {
      editOriginal: false,
      triage: false,
      reply: false,
      dismiss: true,
      delete: true,
    },
    thread: [],
    agentationContext: null,
  } as const;
}

type Record = ReturnType<typeof record>;

// A stateful inbox: acknowledged writes change the rendered list like the
// real hook does before its promise resolves.
function installInbox(initial: readonly Record[]): void {
  useProductFeedbackInbox.mockImplementation(() => {
    const [items, setItems] = useState<readonly Record[]>(initial);
    return {
      status: "all",
      setStatus: vi.fn(),
      type: "all",
      setType: vi.fn(),
      search: "",
      setSearch: vi.fn(),
      items,
      loadedCount: items.length,
      total: items.length,
      hasMore: false,
      view: items.length === 0 ? "empty" : "ready",
      refresh: vi.fn(() => Promise.resolve()),
      changeStatus: vi.fn(() => Promise.resolve()),
      editOriginal: vi.fn(() => Promise.resolve()),
      reply: vi.fn(() => Promise.resolve()),
      dismiss: (id: string) => {
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "wont_fix" as never } : item,
          ),
        );
        return Promise.resolve();
      },
      deleteFeedback: (id: string) => {
        setItems((current) => current.filter((item) => item.id !== id));
        return Promise.resolve();
      },
    };
  });
}

function buttonOf(message: string, name: string): HTMLElement {
  const card = screen.getByText(message).closest("article");
  if (card === null) throw new Error(`No card for ${message}`);
  const button = Array.from(card.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === name,
  );
  if (button === undefined) throw new Error(`No ${name} for ${message}`);
  return button;
}

function detailsButtonOf(message: string): HTMLElement {
  return buttonOf(message, "Details");
}

function deleteRecord(message: string): void {
  fireEvent.click(buttonOf(message, "Delete"));
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductFeedbackPage focus after a record is dismissed or deleted", () => {
  it("moves focus to the Details button of the dismissed record", async () => {
    installInbox([record("a", "First"), record("b", "Second")]);
    render(<ProductFeedbackPage />);
    const dismiss = buttonOf("Second", "Dismiss");
    fireEvent.click(dismiss);
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm dismiss" }));

    await waitFor(() => expect(detailsButtonOf("Second")).toHaveFocus());
  });

  it("moves focus to the next record after a delete", async () => {
    installInbox([
      record("a", "First"),
      record("b", "Second"),
      record("c", "Third"),
    ]);
    render(<ProductFeedbackPage />);
    deleteRecord("Second");

    await waitFor(() => expect(detailsButtonOf("Third")).toHaveFocus());
  });

  it("moves focus to the previous record after deleting the last one", async () => {
    installInbox([record("a", "First"), record("b", "Second")]);
    render(<ProductFeedbackPage />);
    deleteRecord("Second");

    await waitFor(() => expect(detailsButtonOf("First")).toHaveFocus());
  });

  it("moves focus to the list heading after deleting the only record", async () => {
    installInbox([record("a", "Only")]);
    render(<ProductFeedbackPage />);
    deleteRecord("Only");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Feedback" }),
      ).toHaveFocus(),
    );
  });
});
