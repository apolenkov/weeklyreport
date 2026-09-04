// @vitest-environment jsdom
import { MAX_FEEDBACK_MESSAGE_LENGTH } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { buildPageFeedbackPayload } from "./page-feedback-client";

describe("buildPageFeedbackPayload", () => {
  it("builds a bounded pathname-only record without a fake annotation", () => {
    const payload = buildPageFeedbackPayload(
      { type: "change", message: "  Make the summary easier to scan  " },
      { name: "Lead User", email: "lead@example.test" },
      {
        href: "https://reports.example.test/lead/report/123?token=secret#row",
        viewportWidth: 1440,
        viewportHeight: 900,
        userAgent: "test-browser",
        createClientId: () => "page_feedback_123",
      },
    );

    expect(payload).toMatchObject({
      projectName: "weekly-report",
      type: "change",
      message: "Make the summary easier to scan",
      url: "/lead/report/123",
      urlPattern: null,
      viewport: "1440x900",
      userAgent: "test-browser",
      authorName: "Lead User",
      authorEmail: "lead@example.test",
      clientId: "page_feedback_123",
      annotations: [],
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("rejects an empty or oversized page comment", () => {
    const context = {
      href: "https://reports.example.test/lead/report",
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent: "test-browser",
      createClientId: () => "page_feedback_123",
    };

    expect(() =>
      buildPageFeedbackPayload(
        { type: "other", message: " ".repeat(3) },
        { name: "Lead User", email: "lead@example.test" },
        context,
      ),
    ).toThrow();
    expect(() =>
      buildPageFeedbackPayload(
        { type: "other", message: "x".repeat(MAX_FEEDBACK_MESSAGE_LENGTH + 1) },
        { name: "Lead User", email: "lead@example.test" },
        context,
      ),
    ).toThrow();
  });

  it("posts to the authenticated same-origin SitePing ingress", async () => {
    const responseBody = {
      id: "feedback-1",
      projectName: "weekly-report",
      type: "other",
      message: "Page comment",
      status: "open",
      url: "/lead/report",
      urlPattern: null,
      viewport: "1024x768",
      userAgent: "test-browser",
      authorName: "Lead User",
      authorEmail: "lead@example.test",
      authorUserId: "lead-1",
      authorReportingGroupId: "group-1",
      resolvedAt: null,
      createdAt: "2026-09-03T08:00:00.000Z",
      updatedAt: "2026-09-03T08:00:00.000Z",
      annotations: [],
      screenshotUrl: null,
      screenshotRegion: null,
      diagnostics: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(responseBody), { status: 201 }),
      );
    vi.stubGlobal("crypto", { randomUUID: () => "feedback-uuid" });
    window.history.replaceState({}, "", "/lead/report?token=secret#decision");

    const { submitPageFeedback } = await import("./page-feedback-client");
    await submitPageFeedback(
      { type: "other", message: "Page comment" },
      { name: "Lead User", email: "lead@example.test" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/siteping",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(typeof request?.body).toBe("string");
    if (typeof request?.body !== "string") throw new Error("Missing body");
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      url: "/lead/report",
      annotations: [],
      clientId: "page_feedback-uuid",
    });
    expect(JSON.stringify(body)).not.toContain("secret");

    vi.unstubAllGlobals();
  });
});
