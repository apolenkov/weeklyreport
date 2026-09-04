import { randomUUID } from "node:crypto";

import { normalizeFeedbackPath } from "@customreport/shared";

import {
  type FeedbackAccess,
  type FeedbackCreateInput,
  FeedbackDuplicateError,
  FeedbackNotFoundError,
  type FeedbackPage,
  type FeedbackQuery,
  type FeedbackRecord,
  type FeedbackUpdateInput,
  type ProductFeedbackRepository,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

interface ScopedFeedback {
  readonly record: FeedbackRecord;
  readonly authorUserId: string;
  readonly authorReportingGroupId: string | undefined;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

function canRead(access: FeedbackAccess, feedback: ScopedFeedback): boolean {
  if (access.role === "admin") return true;
  if (feedback.authorUserId === access.userId) return true;
  return (
    access.role === "head" &&
    access.reportingGroupId !== undefined &&
    feedback.authorReportingGroupId === access.reportingGroupId
  );
}

function matchesStatus(
  feedback: FeedbackRecord,
  query: FeedbackQuery,
): boolean {
  if (query.statuses?.length) return query.statuses.includes(feedback.status);
  return !query.status || feedback.status === query.status;
}

function matchesQuery(feedback: FeedbackRecord, query: FeedbackQuery): boolean {
  if (query.type && feedback.type !== query.type) return false;
  if (!matchesStatus(feedback, query)) return false;
  if (query.url && feedback.url !== normalizeFeedbackPath(query.url))
    return false;
  if (
    query.urlPattern &&
    feedback.urlPattern !== normalizeFeedbackPath(query.urlPattern)
  ) {
    return false;
  }
  const search = query.search?.trim().toLocaleLowerCase();
  return search
    ? [feedback.message, feedback.authorName, feedback.authorEmail].some(
        (value) => value.toLocaleLowerCase().includes(search),
      )
    : true;
}

export class ProductFeedbackMemoryRepository implements ProductFeedbackRepository {
  private readonly rows = new Map<string, ScopedFeedback>();

  create(
    access: FeedbackAccess,
    input: FeedbackCreateInput,
  ): Promise<FeedbackRecord> {
    const existing = [...this.rows.values()].find(
      ({ record }) => record.clientId === input.clientId,
    );
    if (existing) {
      if (existing.authorUserId !== access.userId) {
        return Promise.reject(new FeedbackDuplicateError());
      }
      return Promise.resolve(existing.record);
    }
    const id = randomUUID();
    const now = new Date();
    const record: FeedbackRecord = {
      id,
      projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
      type: input.type,
      message: input.message,
      status: "open",
      url: normalizeFeedbackPath(input.url),
      urlPattern: input.urlPattern
        ? normalizeFeedbackPath(input.urlPattern)
        : null,
      authorName: access.name,
      authorEmail: access.email,
      authorUserId: access.userId,
      authorReportingGroupId: access.reportingGroupId ?? null,
      viewport: input.viewport,
      userAgent: input.userAgent,
      clientId: input.clientId,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
      annotations: input.annotations.map((annotation) => ({
        id: randomUUID(),
        feedbackId: id,
        ...annotation,
        createdAt: now,
      })),
      screenshotUrl: input.screenshotDataUrl ?? null,
      screenshotRegion: input.screenshotRegion ?? null,
      diagnostics: input.diagnostics ?? null,
      source: "legacy",
      capabilities: {
        editOriginal: false,
        triage: false,
        reply: false,
        dismiss: false,
        delete: false,
      },
      thread: [],
      agentationContext: null,
    };
    this.rows.set(id, {
      record,
      authorUserId: access.userId,
      authorReportingGroupId: access.reportingGroupId,
    });
    return Promise.resolve(record);
  }

  list(
    access: FeedbackAccess,
    query: FeedbackQuery,
    focusId?: string,
  ): Promise<FeedbackPage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE),
    );
    const matches = [...this.rows.values()]
      .filter((feedback) => canRead(access, feedback))
      .map(({ record }) => record)
      .filter((feedback) => matchesQuery(feedback, query))
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    const pageRows = matches.slice((page - 1) * limit, page * limit);
    const focused =
      page === 1 && focusId
        ? matches.find((feedback) => feedback.id === focusId)
        : undefined;
    const feedbacks =
      focused && !pageRows.some((feedback) => feedback.id === focused.id)
        ? [focused, ...pageRows.slice(0, Math.max(0, limit - 1))]
        : pageRows;
    return Promise.resolve({
      feedbacks,
      total: matches.length,
    });
  }

  findByClientId(
    access: FeedbackAccess,
    clientId: string,
  ): Promise<FeedbackRecord | null> {
    const match = [...this.rows.values()].find(
      (feedback) =>
        feedback.record.clientId === clientId && canRead(access, feedback),
    );
    return Promise.resolve(match?.record ?? null);
  }

  update(
    access: FeedbackAccess,
    id: string,
    input: FeedbackUpdateInput,
  ): Promise<FeedbackRecord> {
    const existing = this.rows.get(id);
    if (!existing || !canRead(access, existing)) {
      return Promise.reject(new FeedbackNotFoundError());
    }
    const updated: FeedbackRecord = {
      ...existing.record,
      ...(input.status ? { status: input.status } : {}),
      ...(input.message ? { message: input.message } : {}),
      ...(input.screenshotDataUrl
        ? { screenshotUrl: input.screenshotDataUrl }
        : {}),
      ...(input.resolvedAt !== undefined
        ? { resolvedAt: input.resolvedAt }
        : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, { ...existing, record: updated });
    return Promise.resolve(updated);
  }

  delete(access: FeedbackAccess, id: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing || access.role !== "admin") {
      return Promise.reject(new FeedbackNotFoundError());
    }
    this.rows.delete(id);
    return Promise.resolve();
  }

  owns(access: FeedbackAccess, id: string): Promise<boolean> {
    const feedback = this.rows.get(id);
    return Promise.resolve(feedback !== undefined && canRead(access, feedback));
  }

  ownsAuthor(access: FeedbackAccess, id: string): Promise<boolean> {
    const feedback = this.rows.get(id);
    return Promise.resolve(feedback?.authorUserId === access.userId);
  }
}
