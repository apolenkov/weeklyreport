// @vitest-environment jsdom
import { MAX_FEEDBACK_MESSAGE_LENGTH } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { buildPageFeedbackPayload } from "./page-feedback-client";

describe("buildPageFeedbackPayload", () => {
  it("builds a bounded pathname-only record without a fake annotation", () => {
    const payload = buildPageFeedbackPayload(
      { type: "change", message: "  Make the summary easier to scan  " },
      {
        href: "https://reports.example.test/lead/report/123?token=secret#row",
        viewportWidth: 1440,
        viewportHeight: 900,
        userAgent: "test-browser",
        createClientId: () => "page_123",
      },
    );

    expect(payload).toMatchObject({
      type: "change",
      message: "Make the summary easier to scan",
      url: "/lead/report/123",
      viewport: "1440x900",
      userAgent: "test-browser",
      clientId: "page_123",
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("rejects an empty or oversized page comment", () => {
    const context = {
      href: "https://reports.example.test/lead/report",
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent: "test-browser",
      createClientId: () => "page_123",
    };

    expect(() =>
      buildPageFeedbackPayload(
        { type: "other", message: " ".repeat(3) },
        context,
      ),
    ).toThrow();
    expect(() =>
      buildPageFeedbackPayload(
        { type: "other", message: "x".repeat(MAX_FEEDBACK_MESSAGE_LENGTH + 1) },
        context,
      ),
    ).toThrow();
  });

  it("posts JSON to the authenticated page-feedback ingress", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    window.history.replaceState({}, "", "/lead/report?token=secret#decision");

    const { submitPageFeedback } = await import("./page-feedback-client");
    await submitPageFeedback({ type: "other", message: "Page comment" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/feedback",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toEqual({ "content-type": "application/json" });
    expect(typeof request?.body).toBe("string");
    if (typeof request?.body !== "string") throw new Error("Missing body");
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      type: "other",
      message: "Page comment",
      url: "/lead/report",
    });
    expect(JSON.stringify(body)).not.toContain("secret");

    fetchMock.mockRestore();
  });
});
