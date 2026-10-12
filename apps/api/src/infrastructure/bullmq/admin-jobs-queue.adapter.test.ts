import { QUEUE_NAMES } from "@weeklyreport/shared";
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
    getState: vi.fn<() => Promise<"failed">>().mockResolvedValue("failed"),
    retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function pdfJobRecord(
  data: unknown = {
    jobId: "job-1",
    reportId: "report-1",
    requestedBy: "user-1",
    generation: 1,
  },
  id = "job-1-g1",
) {
  return {
    ...failedJobRecord(),
    id,
    name: "pdf-export",
    data,
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
    const { getState, retry, remove } = handle;
    await expect(getState()).resolves.toBe("failed");
    await expect(retry()).resolves.toBeUndefined();
    await expect(remove()).resolves.toBeUndefined();
    expect(record.getState).toHaveBeenCalledOnce();
    expect(record.retry).toHaveBeenCalledOnce();
    expect(record.remove).toHaveBeenCalledOnce();
  });

  it("exposes the pdf-export payload identity and live state on the handle", async () => {
    const record = pdfJobRecord(
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 2,
      },
      "job-1-g2",
    );
    const handle = createAdminJobHandle("pdf-export", record);

    expect(handle.domainReference).toEqual({
      queue: "pdf-export",
      pdfExportIdentity: {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 2,
      },
    });
    await expect(handle.getState()).resolves.toBe("failed");
    expect(record.getState).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", { reportId: "report-1", requestedBy: "user-1", generation: 1 }],
    [
      "non-string jobId",
      { jobId: 42, reportId: "report-1", requestedBy: "user-1", generation: 1 },
    ],
    [
      "empty reportId",
      { jobId: "job-1", reportId: "", requestedBy: "user-1", generation: 1 },
    ],
    [
      "missing requestedBy",
      { jobId: "job-1", reportId: "report-1", generation: 1 },
    ],
    [
      "missing generation",
      { jobId: "job-1", reportId: "report-1", requestedBy: "user-1" },
    ],
    [
      "non-integer generation",
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 1.5,
      },
    ],
    [
      "zero generation",
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: 0,
      },
    ],
    [
      "string generation",
      {
        jobId: "job-1",
        reportId: "report-1",
        requestedBy: "user-1",
        generation: "1",
      },
    ],
    ["non-object payload", "not-an-object"],
    ["null payload", null],
  ] as const)("fails closed on %s pdf-export identity", (_label, data) => {
    const handle = createAdminJobHandle("pdf-export", pdfJobRecord(data));

    expect(handle.domainReference).toEqual({
      queue: "pdf-export",
      pdfExportIdentity: null,
    });
  });

  it.each([
    // Legacy bare durable id — predates generation-scoped queue ids.
    ["job-1", 1],
    // Generation inside the queue id disagrees with the payload's.
    ["job-1-g2", 1],
    ["job-1-g1", 2],
    // Suffix shape is right but bound to a different durable jobId.
    ["other-job-g1", 1],
  ] as const)(
    "fails closed when the retained queue id %s does not match the payload generation %s",
    (id, generation) => {
      const handle = createAdminJobHandle(
        "pdf-export",
        pdfJobRecord(
          {
            jobId: "job-1",
            reportId: "report-1",
            requestedBy: "user-1",
            generation,
          },
          id,
        ),
      );

      expect(handle.domainReference).toEqual({
        queue: "pdf-export",
        pdfExportIdentity: null,
      });
    },
  );

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
      } else if (queue === "pdf-export") {
        // The reminder-shaped payload carries no pdf identity triple.
        expect(handle.domainReference).toEqual({
          queue,
          pdfExportIdentity: null,
        });
      } else {
        expect(handle.domainReference).toEqual({ queue });
        expect(handle.domainReference).not.toHaveProperty(
          "reminderExecutionId",
        );
        expect(handle.domainReference).not.toHaveProperty("pdfExportIdentity");
      }
    },
  );
});
