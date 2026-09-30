// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { SectionReviewRow } from "../model/section-review-rows";
import { ReviewVerdictBand } from "./review-verdict-band";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: vi.fn(),
}));

const row = (id: string, authorName: string): SectionReviewRow => ({
  reportSectionId: `${id}-1111-4111-8111-111111111111`,
  version: 1,
  authorName,
  status: "submitted",
  reviews: [],
  canReview: true,
  groupId: null,
});

const ADA = row("aaaaaaaa", "Ada Lovelace");
const GRACE = row("bbbbbbbb", "Grace Hopper");

function Harness({
  initial,
  mutationFn,
}: {
  readonly initial: readonly SectionReviewRow[];
  readonly mutationFn: ReturnType<typeof createMockTRPC>["captured"][string];
}) {
  const [sections, setSections] = useState(initial);
  // Mirrors the server: a changes-requested verdict returns the section to draft.
  mutationFn.mutationFn.mockImplementation((input: unknown) => {
    const id =
      typeof input === "object" && input !== null && "reportSectionId" in input
        ? input.reportSectionId
        : undefined;
    setSections((current) =>
      current.map((section) =>
        section.reportSectionId === id
          ? { ...section, status: "draft" }
          : section,
      ),
    );
    return Promise.resolve({
      unsubmitted: true,
      verdict: "changes_requested",
      judgedVersion: 1,
    });
  });
  return (
    <>
      {/* Stands in for a refetch that drops a row without the reviewer acting. */}
      <button type="button" onClick={() => setSections((c) => c.slice(1))}>
        Refetch
      </button>
      <ReviewVerdictBand sections={sections} onMutated={vi.fn()} />
    </>
  );
}

function renderBand(initial: readonly SectionReviewRow[]) {
  const { proxy, captured } = createMockTRPC([
    { path: ["review", "verdict"], mutation: true },
  ]);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        {children}
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  render(
    <Harness
      initial={initial}
      mutationFn={expectDefined(captured["review.verdict"])}
    />,
    { wrapper },
  );
}

async function requestChangesFor(name: string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Request changes for ${name}` }),
  );
  const dialog = within(screen.getByRole("dialog"));
  await userEvent.type(dialog.getByLabelText("Reason for the lead"), "Fix it.");
  await userEvent.click(
    dialog.getByRole("button", { name: "Request changes" }),
  );
}

describe("ReviewVerdictBand", () => {
  it("names every verdict button after its lead", () => {
    renderBand([ADA, GRACE]);

    expect(
      screen.getByRole("button", { name: "Approve Ada Lovelace" }),
    ).toHaveTextContent("Approve");
    expect(
      screen.getByRole("button", { name: "Request changes for Ada Lovelace" }),
    ).toHaveTextContent("Request changes");
    expect(
      screen.getByRole("button", { name: "Approve Grace Hopper" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request changes for Grace Hopper" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("moves focus to the review band when requesting changes removes the row", async () => {
    renderBand([ADA, GRACE]);

    await requestChangesFor("Ada Lovelace");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Approve Ada Lovelace" }),
      ).toBeNull();
    });
    expect(
      screen.getByRole("region", { name: "Section reviews" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Approve Grace Hopper" }),
    ).toBeInTheDocument();
  });

  it("keeps the band and focuses it after the last row is actioned", async () => {
    renderBand([ADA]);

    await requestChangesFor("Ada Lovelace");

    const band = await screen.findByRole("region", { name: "Section reviews" });
    await waitFor(() => expect(band).toHaveFocus());
    expect(
      within(band).getByText("No submitted sections left to review."),
    ).toBeInTheDocument();
  });

  it("leaves focus alone when a row disappears while the reviewer works elsewhere", async () => {
    renderBand([ADA, GRACE]);
    const refetch = screen.getByRole("button", { name: "Refetch" });

    await userEvent.click(refetch);

    expect(
      screen.queryByRole("button", { name: "Approve Ada Lovelace" }),
    ).toBeNull();
    expect(refetch).toHaveFocus();
  });

  it("renders nothing when no section is awaiting review", () => {
    renderBand([]);
    expect(
      screen.queryByRole("region", { name: "Section reviews" }),
    ).toBeNull();
  });
});
