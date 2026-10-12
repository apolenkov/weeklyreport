import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  feedbackAccessFromSession,
  type FeedbackCreateInput,
} from "../modules/product-feedback/product-feedback.repository";
import { ProductFeedbackMemoryRepository } from "./product-feedback.memory-repository";

function session(
  userId: string,
  role: UserSession["role"],
  reportingGroupId?: string,
): UserSession {
  return {
    userId,
    role,
    reportingGroupId,
    name: `${role} ${userId}`,
    email: `${userId}@example.test`,
  };
}

function input(clientId: string): FeedbackCreateInput {
  return {
    projectName: "spoofed",
    type: "bug",
    message: `Feedback ${clientId}`,
    status: "resolved",
    url: `/reports/${clientId}?secret=value`,
    urlPattern: null,
    viewport: "1440x900",
    userAgent: "test",
    authorName: "Spoofed",
    authorEmail: "spoofed@example.test",
    clientId,
    annotations: [],
  };
}

function capturedInput(clientId: string): FeedbackCreateInput {
  return {
    ...input(clientId),
    screenshotDataUrl: "data:image/jpeg;base64,AA==",
    screenshotRegion: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
    diagnostics: {
      console: [
        {
          level: "error",
          timestamp: "2026-09-03T10:00:00.000Z",
          message: "Request failed",
        },
      ],
      network: [],
    },
  };
}

describe("ProductFeedbackMemoryRepository", () => {
  it("applies own, group, and global read scopes", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const leadA = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const leadB = feedbackAccessFromSession(session("lead-b", "lead", "g2"));
    const head = feedbackAccessFromSession(session("head", "head", "g1"));
    const admin = feedbackAccessFromSession(session("admin", "admin"));

    await repo.create(leadA, input("one"));
    await repo.create(leadB, input("two"));
    await repo.create(head, input("three"));

    await expect(
      repo.list(leadA, { projectName: "ignored" }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      repo.list(head, { projectName: "ignored" }),
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      repo.list(admin, { projectName: "ignored" }),
    ).resolves.toMatchObject({ total: 3 });
  });

  it("overwrites attribution, product, status, and URL scope", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const access = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const feedback = await repo.create(access, input("owned"));

    expect(feedback).toMatchObject({
      projectName: "weekly-report",
      status: "open",
      authorName: "lead lead-a",
      authorEmail: "lead-a@example.test",
      url: "/reports/owned",
      screenshotUrl: null,
      diagnostics: null,
    });
  });

  it("persists bounded screenshot and diagnostic context", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const access = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const capture = capturedInput("captured");
    await repo.create(access, capture);

    capture.diagnostics?.console.push({
      level: "warn",
      timestamp: "2026-09-03T10:00:01.000Z",
      message: "Later caller diagnostic",
    });
    if (capture.screenshotRegion) capture.screenshotRegion.xPct = 0.9;
    const stored = await repo.list(access, {});
    expect(stored.feedbacks[0]).toMatchObject({
      screenshotUrl: "data:image/jpeg;base64,AA==",
      screenshotRegion: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
      diagnostics: { console: [{ level: "error" }], network: [] },
    });
  });

  it("prioritizes an authorized focused record outside the first page", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const access = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const oldest = await repo.create(access, input("oldest"));
    await new Promise((resolve) => setTimeout(resolve, 2));
    for (let index = 0; index < 20; index += 1) {
      await repo.create(access, input(`newer_${index}`));
    }

    const page = await repo.list(
      access,
      { projectName: "weekly-report", page: 1, limit: 20 },
      oldest.id,
    );
    expect(page.feedbacks).toHaveLength(20);
    expect(page.feedbacks[0]?.id).toBe(oldest.id);
    expect(page.total).toBe(21);
  });

  it("allows own and group triage while restricting deletion to admin", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const leadA = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const headA = feedbackAccessFromSession(session("head-a", "head", "g1"));
    const headB = feedbackAccessFromSession(session("head-b", "head", "g2"));
    const admin = feedbackAccessFromSession(session("admin", "admin"));
    const feedback = await repo.create(leadA, input("triage"));
    const adminTarget = await repo.create(leadA, input("admin-delete"));

    await expect(
      repo.update(leadA, feedback.id, {
        status: "in_progress",
        resolvedAt: null,
      }),
    ).resolves.toMatchObject({ status: "in_progress" });

    await expect(
      repo.update(headA, feedback.id, {
        status: "resolved",
        resolvedAt: new Date(),
      }),
    ).resolves.toMatchObject({ status: "resolved" });
    await expect(
      repo.update(headB, feedback.id, {
        status: "open",
        resolvedAt: null,
      }),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    await expect(repo.delete(headA, feedback.id)).rejects.toMatchObject({
      code: "STORE_NOT_FOUND",
    });
    await expect(repo.delete(leadA, feedback.id)).rejects.toMatchObject({
      code: "STORE_NOT_FOUND",
    });
    await expect(repo.delete(admin, adminTarget.id)).resolves.toBeUndefined();
  });

  it.each(["create", "retry", "list", "focused", "update"] as const)(
    "isolates values returned by %s from stored feedback",
    async (boundary) => {
      const repo = new ProductFeedbackMemoryRepository();
      const access = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
      const seed = capturedInput(`detached-${boundary}`);
      const created = await repo.create(access, seed);
      const returned =
        boundary === "retry"
          ? await repo.create(access, seed)
          : boundary === "update"
            ? await repo.update(access, created.id, { status: "in_progress" })
            : boundary === "list" || boundary === "focused"
              ? (
                  await repo.list(
                    access,
                    {},
                    boundary === "focused" ? created.id : undefined,
                  )
                ).feedbacks[0]
              : created;
      if (!returned) throw new Error("Authorized feedback result missing");
      returned.diagnostics?.console.splice(0);
      returned.createdAt.setTime(0);
      const stored = (await repo.list(access, {})).feedbacks[0];
      expect(stored?.diagnostics?.console).toHaveLength(1);
      expect(stored?.createdAt.getTime()).not.toBe(0);
      expect(stored?.id).toBe(created.id);
    },
  );

  it("isolates a mutable resolvedAt input until an explicit update", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const access = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const created = await repo.create(access, input("resolution"));
    const resolvedAt = new Date("2026-09-03T10:00:00.000Z");
    await repo.update(access, created.id, { status: "resolved", resolvedAt });
    resolvedAt.setTime(0);
    expect((await repo.list(access, {})).feedbacks[0]?.resolvedAt).toEqual(
      new Date("2026-09-03T10:00:00.000Z"),
    );
  });

  it("is idempotent only for the same immutable author", async () => {
    const repo = new ProductFeedbackMemoryRepository();
    const leadA = feedbackAccessFromSession(session("lead-a", "lead", "g1"));
    const leadB = feedbackAccessFromSession(session("lead-b", "lead", "g1"));
    const first = await repo.create(leadA, input("retry"));

    await expect(repo.create(leadA, input("retry"))).resolves.toEqual(first);
    await expect(repo.create(leadB, input("retry"))).rejects.toMatchObject({
      code: "STORE_DUPLICATE",
    });
  });
});
