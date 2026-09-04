// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { FeedbackResponse } from "@customreport/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProductFeedbackInbox } from "./use-product-feedback-inbox";

const feedback: FeedbackResponse = {
  id: "agentation_annotation-1",
  projectName: "weekly-report",
  type: "change",
  message: "Original feedback",
  status: "open",
  url: "/lead/report/report-1",
  urlPattern: null,
  viewport: "1440x900",
  userAgent: "Agentation",
  clientId: "agentation:annotation-1",
  annotations: [],
  authorUserId: "lead-user",
  authorReportingGroupId: "group-1",
  authorName: "Lead User",
  authorEmail: "lead@example.test",
  resolvedAt: null,
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T10:00:00.000Z",
  screenshotUrl: null,
  screenshotRegion: null,
  diagnostics: null,
  agentationSessionId: "session-1",
  agentationAnnotationId: "annotation-1",
  source: "agentation",
  capabilities: {
    editOriginal: true,
    triage: false,
    reply: true,
    dismiss: false,
    delete: true,
  },
  thread: [],
  agentationContext: null,
};

const response = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: () => Promise.resolve(body),
  }) as Response;

describe("useProductFeedbackInbox mutations", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the workbench contracts and replaces records without a loading flash", async () => {
    fetchMock.mockResolvedValueOnce(response({ feedback: [feedback] }));
    const onError = vi.fn();
    const { result } = renderHook(() => useProductFeedbackInbox(onError));
    await waitFor(() => expect(result.current.view).toBe("ready"));

    const edited = { ...feedback, message: "Edited feedback" };
    fetchMock.mockResolvedValueOnce(response(edited));
    await act(() => result.current.editOriginal(feedback.id, edited.message));
    expect(result.current.view).toBe("ready");
    expect(result.current.items[0]?.message).toBe(edited.message);

    const replied = {
      ...edited,
      thread: [
        {
          id: "message-1",
          role: "human" as const,
          content: "Please retest",
          timestamp: "2026-09-04T10:05:00.000Z",
          authorUserId: "admin-user",
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(response(replied));
    await act(() => result.current.reply(feedback.id, "Please retest"));
    expect(result.current.items[0]?.thread).toHaveLength(1);

    const dismissed = {
      ...replied,
      status: "wont_fix" as const,
      capabilities: { ...replied.capabilities, dismiss: false },
    };
    fetchMock.mockResolvedValueOnce(response(dismissed));
    await act(() => result.current.dismiss(feedback.id, "Not actionable"));
    expect(result.current.items[0]?.status).toBe("wont_fix");

    fetchMock.mockResolvedValueOnce(response({}, true));
    await act(() => result.current.deleteFeedback(feedback.id));
    expect(result.current.items).toHaveLength(0);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[1]).toEqual([
      `/api/v1/feedback/${feedback.id}`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ comment: "Edited feedback" }),
      }),
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      `/api/v1/feedback/${feedback.id}/replies`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Please retest" }),
      }),
    ]);
    expect(fetchMock.mock.calls[3]).toEqual([
      `/api/v1/feedback/${feedback.id}/dismiss`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Not actionable" }),
      }),
    ]);
    expect(fetchMock.mock.calls[4]).toEqual([
      `/api/v1/feedback/${feedback.id}`,
      expect.objectContaining({ method: "DELETE" }),
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps current records visible when a mutation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ feedback: [feedback] }))
      .mockResolvedValueOnce(response({}, false));
    const onError = vi.fn();
    const { result } = renderHook(() => useProductFeedbackInbox(onError));
    await waitFor(() => expect(result.current.view).toBe("ready"));

    await expect(
      act(() => result.current.reply(feedback.id, "Please retest")),
    ).rejects.toThrow("Feedback update failed");
    expect(result.current.view).toBe("ready");
    expect(result.current.items[0]?.message).toBe(feedback.message);
  });
});
