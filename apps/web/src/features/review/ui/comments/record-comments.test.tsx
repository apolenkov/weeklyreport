// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import {
  type RecordCommentView,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewCommentInputSchema,
} from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordComments } from "./record-comments";

const mutationCalls = vi.hoisted(() => ({
  comment: [] as unknown[],
  deleteComment: [] as unknown[],
  commentError: null as Error | null,
  deleteError: null as Error | null,
  commentPending: null as Promise<unknown> | null,
}));

vi.mock("../../../../shared/lib/query/cache-keys", () => ({
  invalidateReview: vi.fn(),
}));

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    review: {
      comment: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: (input: unknown) => {
            mutationCalls.comment.push(input);
            if (mutationCalls.commentPending != null) {
              return mutationCalls.commentPending;
            }
            if (mutationCalls.commentError) {
              return Promise.reject(mutationCalls.commentError);
            }
            return Promise.resolve({});
          },
        }),
      },
      deleteComment: {
        mutationOptions: (options: Record<string, unknown>) => ({
          ...options,
          mutationFn: (input: unknown) => {
            mutationCalls.deleteComment.push(input);
            if (mutationCalls.deleteError) {
              return Promise.reject(mutationCalls.deleteError);
            }
            return Promise.resolve({});
          },
        }),
      },
    },
  }),
}));

const REVIEWER_ID = "22222222-2222-4222-8222-222222222222";

const OWN_COMMENT: RecordCommentView = {
  id: "33333333-3333-4333-8333-333333333333",
  reviewerId: REVIEWER_ID,
  reviewerName: "Head Reviewer",
  text: "Please split this item.",
  createdAt: new Date("2026-07-01T10:00:00Z"),
};

beforeEach(() => {
  mutationCalls.comment.length = 0;
  mutationCalls.deleteComment.length = 0;
  mutationCalls.commentError = null;
  mutationCalls.deleteError = null;
  mutationCalls.commentPending = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithClient(ui: ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

function renderComments() {
  return renderWithClient(
    <RecordComments
      anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
      comments={[OWN_COMMENT]}
      canReview
      currentUserId={REVIEWER_ID}
      isAdmin={false}
      onMutated={vi.fn()}
    />,
  );
}

describe("RecordComments — mutation success", () => {
  it("names each composer after its record when a subject is given", () => {
    renderWithClient(
      <>
        <RecordComments
          anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
          comments={[]}
          canReview
          currentUserId={REVIEWER_ID}
          isAdmin={false}
          subject="Ship the billing export"
          onMutated={vi.fn()}
        />
        <RecordComments
          anchor={{ riskId: "55555555-5555-4555-8555-555555555555" }}
          comments={[]}
          canReview
          currentUserId={REVIEWER_ID}
          isAdmin={false}
          subject={"Vendor delay ".repeat(10)}
          onMutated={vi.fn()}
        />
      </>,
    );

    expect(
      screen.getByRole("textbox", {
        name: "Add a review comment on Ship the billing export",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: /^Add a review comment on Vendor delay .+…$/u,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Add a review comment" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Comment on Ship the billing export",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Comment on Vendor delay .+…$/u }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comment" })).toBeNull();
  });

  it("scopes character descriptions to each rendered composer", () => {
    renderWithClient(
      <>
        <RecordComments
          anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
          comments={[]}
          canReview
          currentUserId={REVIEWER_ID}
          isAdmin={false}
          onMutated={vi.fn()}
        />
        <RecordComments
          anchor={{ riskId: "55555555-5555-4555-8555-555555555555" }}
          comments={[]}
          canReview
          currentUserId={REVIEWER_ID}
          isAdmin={false}
          onMutated={vi.fn()}
        />
      </>,
    );
    const [first, second] = screen.getAllByRole("textbox", {
      name: "Add a review comment",
    });
    if (!first || !second) throw new Error("Expected two comment composers");

    fireEvent.change(first, { target: { value: "Short" } });
    fireEvent.change(second, {
      target: { value: "A".repeat(REVIEW_COMMENT_MAX_LENGTH + 1) },
    });

    const firstDescriptionIds = first.getAttribute("aria-describedby");
    const secondDescriptionIds = second.getAttribute("aria-describedby");
    if (firstDescriptionIds === null || secondDescriptionIds === null) {
      throw new Error("Expected associated composer descriptions");
    }
    expect(firstDescriptionIds).not.toBe(secondDescriptionIds);
    expect(first).toHaveAccessibleDescription("5 / 2000");
    expect(second).toHaveAccessibleDescription(
      "2001 / 2000 Comment must be 2000 characters or fewer.",
    );
    for (const id of `${firstDescriptionIds} ${secondDescriptionIds}`.split(
      " ",
    )) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it.each([
    ["empty", "", 0],
    ["ordinary whitespace", " ".repeat(3), 3],
    ["zero-width space", "\u200B", 1],
    ["zero-width non-joiner", "\u200C", 1],
    ["zero-width joiner", "\u200D", 1],
    [
      "unsupported draft within the code-point budget",
      `${"😀".repeat(1000)}\u0000`,
      1001,
    ],
  ] as const)(
    "retains and locally rejects an invalid draft: %s",
    (_label, draftValue, characterCount) => {
      renderComments();
      const draft = screen.getByRole("textbox", {
        name: "Add a review comment",
      });
      fireEvent.change(draft, { target: { value: draftValue } });
      const form = draft.closest("form");
      if (form === null) throw new Error("Expected comment form");
      fireEvent.submit(form);

      expect(draft).toHaveValue(draftValue);
      expect(draft).toHaveAttribute("aria-invalid", "true");
      expect(draft).toHaveAccessibleDescription(
        `${characterCount} / ${REVIEW_COMMENT_MAX_LENGTH} Comment must contain visible characters.`,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Comment must contain visible characters.",
      );
      expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
      expect(mutationCalls.comment).toHaveLength(0);
    },
  );

  it.each([1, REVIEW_COMMENT_MAX_LENGTH])(
    "submits exactly %i visible characters with the valid anchor",
    async (length) => {
      renderComments();
      const boundary = "A".repeat(length);
      const draft = screen.getByRole("textbox", {
        name: "Add a review comment",
      });
      fireEvent.change(draft, { target: { value: boundary } });
      fireEvent.click(screen.getByRole("button", { name: "Comment" }));

      await waitFor(() => {
        expect(mutationCalls.comment).toEqual([
          {
            itemId: "11111111-1111-4111-8111-111111111111",
            text: boundary,
          },
        ]);
      });
    },
  );

  it("keeps 2,001 pasted characters and blocks mutation locally", () => {
    renderComments();
    const overLimit = "A".repeat(REVIEW_COMMENT_MAX_LENGTH + 1);
    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    fireEvent.change(draft, { target: { value: overLimit } });

    expect(draft).toHaveValue(overLimit);
    expect(draft).toHaveAttribute("aria-invalid", "true");
    expect(draft).toHaveAccessibleDescription(
      `${REVIEW_COMMENT_MAX_LENGTH + 1} / ${REVIEW_COMMENT_MAX_LENGTH} Comment must be ${REVIEW_COMMENT_MAX_LENGTH} characters or fewer.`,
    );
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
    expect(mutationCalls.comment).toHaveLength(0);
  });

  it.each([
    ["non-BMP", "😀".repeat(2000)],
    ["combining sequences", "e\u0301".repeat(1000)],
  ])(
    "counts and submits a schema-valid 2,000-point %s comment",
    async (_name, boundary) => {
      const user = userEvent.setup();
      const command = reviewCommentInputSchema.parse({
        itemId: "11111111-1111-4111-8111-111111111111",
        text: boundary,
      });
      renderComments();
      const draft = screen.getByRole("textbox", {
        name: "Add a review comment",
      });
      await user.click(draft);
      await user.paste(boundary);
      expect(draft).toHaveValue(boundary);
      expect(draft).toHaveAccessibleDescription("2000 / 2000");
      expect(draft).toHaveAttribute("aria-invalid", "false");
      await user.click(screen.getByRole("button", { name: "Comment" }));
      await waitFor(() => {
        expect(mutationCalls.comment).toEqual([command]);
      });
    },
  );

  it("retains a 2,001-point non-BMP draft and submits only after correction", async () => {
    const user = userEvent.setup();
    const overLimit = "😀".repeat(2001);
    const boundary = "😀".repeat(2000);
    expect(
      reviewCommentInputSchema.safeParse({
        itemId: "11111111-1111-4111-8111-111111111111",
        text: overLimit,
      }).success,
    ).toBe(false);
    renderComments();
    const draft = screen.getByRole("textbox", { name: "Add a review comment" });
    const submit = screen.getByRole("button", { name: "Comment" });
    await user.click(draft);
    await user.paste(overLimit);
    expect(draft).toHaveValue(overLimit);
    expect(draft).not.toHaveAttribute("maxlength");
    expect(draft).toHaveAccessibleDescription(
      "2001 / 2000 Comment must be 2000 characters or fewer.",
    );
    expect(submit).toBeDisabled();
    expect(mutationCalls.comment).toHaveLength(0);
    await user.clear(draft);
    await user.paste(boundary);
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => {
      expect(mutationCalls.comment).toEqual([
        reviewCommentInputSchema.parse({
          itemId: "11111111-1111-4111-8111-111111111111",
          text: boundary,
        }),
      ]);
    });
  });

  it("submits once after an over-limit draft is corrected to 2,000 characters", async () => {
    const user = userEvent.setup();
    renderComments();
    const overLimit = "A".repeat(REVIEW_COMMENT_MAX_LENGTH + 1);
    const atLimit = overLimit.slice(0, REVIEW_COMMENT_MAX_LENGTH);
    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    const submit = screen.getByRole("button", { name: "Comment" });

    fireEvent.change(draft, { target: { value: overLimit } });
    expect(submit).toBeDisabled();
    expect(mutationCalls.comment).toHaveLength(0);

    await user.click(draft);
    await user.keyboard("{End}{Backspace}{Tab}");
    expect(submit).toBeEnabled();
    expect(submit).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mutationCalls.comment).toEqual([
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          text: atLimit,
        },
      ]);
    });
  });

  it("does not render serialized validation details from the server", async () => {
    mutationCalls.commentError = new Error(
      '[{"code":"too_big","maximum":2000,"path":["text"]}]',
    );
    renderComments();
    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    fireEvent.change(draft, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Comment could not be saved. Check its content and try again.",
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent("too_big");
      expect(draft).toHaveValue("Keep this draft");
    });
  });

  it("clears the draft and reports a successful add", async () => {
    const onMutated = vi.fn();
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[OWN_COMMENT]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={onMutated}
      />,
    );

    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    fireEvent.change(draft, { target: { value: "Ready to publish." } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => {
      expect(onMutated).toHaveBeenCalledTimes(1);
      expect(draft).toHaveValue("");
      expect(screen.getByRole("status")).toHaveTextContent("Comment added.");
      expect(mutationCalls.comment).toEqual([
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          text: "Ready to publish.",
        },
      ]);
    });
  });

  it("keeps draft text while submit is pending and clears it after success", async () => {
    const commentPending = Promise.withResolvers<unknown>();
    mutationCalls.commentPending = commentPending.promise;
    const user = userEvent.setup();
    renderComments();

    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    await user.type(draft, "Alpha");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(draft).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adding…" })).toBeInTheDocument();

    await user.type(draft, "Beta");
    expect(draft).toHaveValue("Alpha");

    commentPending.resolve({});

    await waitFor(() => {
      expect(mutationCalls.comment).toHaveLength(1);
      expect(mutationCalls.comment).toEqual([
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          text: "Alpha",
        },
      ]);
      expect(screen.getByRole("status")).toHaveTextContent("Comment added.");
      expect(draft).toHaveValue("");
      expect(draft).not.toBeDisabled();
    });
  });

  it("keeps draft text while pending and retains it after add failure", async () => {
    const commentPending = Promise.withResolvers<unknown>();
    mutationCalls.commentPending = commentPending.promise;
    mutationCalls.commentError = new Error("Comment could not be saved");
    const user = userEvent.setup();
    renderComments();

    const draft = screen.getByRole("textbox", {
      name: "Add a review comment",
    });
    await user.type(draft, "Alpha");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(draft).toBeDisabled();
    await user.type(draft, "Beta");
    expect(draft).toHaveValue("Alpha");

    commentPending.reject(mutationCalls.commentError);

    await waitFor(() => {
      expect(mutationCalls.comment).toHaveLength(1);
      expect(mutationCalls.comment).toEqual([
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          text: "Alpha",
        },
      ]);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Comment could not be saved",
      );
      expect(draft).toHaveValue("Alpha");
      expect(draft).not.toBeDisabled();
    });
  });

  it("reports a successful delete", async () => {
    const onMutated = vi.fn();
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[OWN_COMMENT]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={onMutated}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Delete comment by Head Reviewer/ }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete review comment?",
    });
    expect(dialog).toHaveTextContent(OWN_COMMENT.text);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onMutated).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("Comment deleted.");
      expect(mutationCalls.deleteComment).toEqual([
        { commentId: OWN_COMMENT.id },
      ]);
    });
  });

  it("keeps a failed add visible as inline live feedback", async () => {
    mutationCalls.commentError = new Error("Comment could not be saved");
    renderComments();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Add a review comment" }),
      {
        target: { value: "Ready to publish." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Comment could not be saved",
      );
    });
  });

  it("does not delete when the confirmation is cancelled", () => {
    renderComments();

    fireEvent.click(
      screen.getByRole("button", { name: /Delete comment by Head Reviewer/ }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete review comment?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(mutationCalls.deleteComment).toHaveLength(0);
    expect(
      screen.queryByRole("alertdialog", { name: "Delete review comment?" }),
    ).not.toBeInTheDocument();
  });

  it("names each delete action with its comment context", () => {
    const secondComment: RecordCommentView = {
      ...OWN_COMMENT,
      id: "44444444-4444-4444-8444-444444444444",
      reviewerName: "Another Reviewer",
      text: "Please add the rollout date.",
    };
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[OWN_COMMENT, secondComment]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Delete comment by Head Reviewer: Please split this item.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Delete comment by Another Reviewer: Please add the rollout date.",
      }),
    ).toBeInTheDocument();
  });
});

describe("RecordComments — compact touch floor", () => {
  // jsdom cannot evaluate media queries; the class assertions are the teeth.
  it("the per-comment Delete text-link floors its hit area below md", () => {
    renderComments();

    const deleteLink = screen.getByRole("button", {
      name: /Delete comment by Head Reviewer/,
    });
    // Visually it stays a text link; only the hit area grows on phones.
    expect(deleteLink.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
    expect(deleteLink.className).toContain(
      "max-md:min-w-[var(--touch-target-min)]",
    );
  });

  it("the composer submit button floors at the touch target below md", () => {
    renderComments();

    const submit = screen.getByRole("button", { name: "Comment" });
    expect(submit.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});

describe("RecordComments — authorization branches", () => {
  it("hides the composer for a non-UUID (synthetic) anchor id", () => {
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "client-temp-id" }}
        comments={[OWN_COMMENT]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("hides the composer when canReview is false, even for a valid UUID anchor", () => {
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[OWN_COMMENT]}
        canReview={false}
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("hides the Delete control for a comment authored by someone else (non-admin)", () => {
    const otherAuthorComment: RecordCommentView = {
      ...OWN_COMMENT,
      id: "44444444-4444-4444-8444-444444444444",
      reviewerId: "55555555-5555-4555-8555-555555555555",
    };
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[otherAuthorComment]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin={false}
        onMutated={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Delete comment by/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the Delete control for every comment when isAdmin, regardless of author", () => {
    const otherAuthorComment: RecordCommentView = {
      ...OWN_COMMENT,
      id: "44444444-4444-4444-8444-444444444444",
      reviewerId: "55555555-5555-4555-8555-555555555555",
    };
    renderWithClient(
      <RecordComments
        anchor={{ itemId: "11111111-1111-4111-8111-111111111111" }}
        comments={[otherAuthorComment]}
        canReview
        currentUserId={REVIEWER_ID}
        isAdmin
        onMutated={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Delete comment by/ }),
    ).toBeInTheDocument();
  });

  it("shows the Delete control for the caller's own comment when canReview (baseline)", () => {
    renderComments();

    expect(
      screen.getByRole("button", { name: /Delete comment by/ }),
    ).toBeInTheDocument();
  });
});
