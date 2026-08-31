import { QUEUE_NAMES } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createAdminJobHandle } from "./admin-jobs-queue.adapter";

function failedJobRecord() {
  return {
    id: "job-1",
    name: "send-reminder-email",
    failedReason: "SMTP timeout",
    stacktrace: ["at smtpClient.send (smtp.ts:42)"],
    attemptsMade: 3,
    timestamp: 1_700_000_000_000,
    data: { executionId: "execution-1" },
    retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe("createAdminJobHandle", () => {
  it("validates one complete failed-job DTO at the BullMQ boundary", async () => {
    const record = failedJobRecord();
    const handle = createAdminJobHandle("email-reminder", record);

    expect(handle.failedJob).toEqual({
      id: "job-1",
      name: "send-reminder-email",
      failedReason: "SMTP timeout",
      stacktrace: ["at smtpClient.send (smtp.ts:42)"],
      attemptsMade: 3,
      timestamp: 1_700_000_000_000,
    });
    expect(handle.domainReference).toEqual({
      queue: "email-reminder",
      reminderExecutionId: "execution-1",
    });
    const { retry, remove } = handle;
    await expect(retry()).resolves.toBeUndefined();
    await expect(remove()).resolves.toBeUndefined();
    expect(record.retry).toHaveBeenCalledOnce();
    expect(record.remove).toHaveBeenCalledOnce();
  });

  it.each(["id", "failedReason", "stacktrace", "attemptsMade"] as const)(
    "rejects a failed job without its required %s field",
    (field) => {
      const record = failedJobRecord();
      expect(Reflect.deleteProperty(record, field)).toBe(true);

      expect(() => createAdminJobHandle("email-reminder", record)).toThrow();
    },
  );

  it("rejects an empty failed reason at the queue boundary", () => {
    expect(() =>
      createAdminJobHandle("email-reminder", {
        ...failedJobRecord(),
        failedReason: "",
      }),
    ).toThrow();
  });

  it("does not expose the processor payload through failed-job metadata", () => {
    const handle = createAdminJobHandle("email-reminder", {
      ...failedJobRecord(),
      data: {
        executionId: "execution-1",
        recipientEmail: "lead@example.com",
        sectionUrl: "https://reports.example/sections/private",
      },
    });

    expect(handle.failedJob).not.toHaveProperty("data");
  });

  it.each(QUEUE_NAMES)(
    "tags the handle with its canonical %s queue domain",
    (queue) => {
      const handle = createAdminJobHandle(queue, failedJobRecord());

      expect(handle.domainReference.queue).toBe(queue);
      if (queue === "email-reminder") {
        expect(handle.domainReference).toEqual({
          queue,
          reminderExecutionId: "execution-1",
        });
      } else {
        expect(handle.domainReference).toEqual({ queue });
        expect(handle.domainReference).not.toHaveProperty(
          "reminderExecutionId",
        );
      }
    },
  );
});
