import type { AgentationInboxRow } from "./agentation-inbox-projection.js";

type AgentationInboxRowFixture = Omit<
  Partial<AgentationInboxRow>,
  "session"
> & {
  readonly session?: Partial<AgentationInboxRow["session"]>;
};

export function makeAgentationInboxRow(
  overrides: AgentationInboxRowFixture = {},
): AgentationInboxRow {
  const { session: sessionOverrides, ...rowOverrides } = overrides;
  const now = new Date("2026-09-04T10:00:00.000Z");
  return {
    id: "a-1",
    clientId: "c-1",
    sessionId: "s-1",
    x: 20,
    y: 30,
    comment: "Move this button",
    element: "button",
    elementPath: "#save",
    timestamp: 1n,
    selectedText: null,
    boundingBox: null,
    nearbyText: "Save",
    cssClasses: null,
    nearbyElements: null,
    computedStyles: null,
    fullPath: null,
    accessibility: null,
    isMultiSelect: false,
    isFixed: false,
    reactComponents: null,
    sourceFile: null,
    drawingIndex: null,
    elementBoundingBoxes: null,
    placement: null,
    rearrange: null,
    url: "https://app.example.test/report?x=1",
    kind: "feedback",
    intent: "change",
    severity: "important",
    status: "pending",
    resolvedAt: null,
    resolvedBy: null,
    authorUserId: "u-lead",
    authorReportingGroupId: "g-1",
    authorRole: "lead",
    authorName: "Lead Snapshot",
    authorEmail: "lead@example.test",
    createdAt: now,
    updatedAt: now,
    threadMessages: [],
    session: {
      id: "s-1",
      url: "https://app.example.test/report",
      status: "active",
      projectId: "weekly-report",
      metadata: null,
      authorUserId: "u-lead",
      authorReportingGroupId: "g-1",
      authorRole: "lead",
      authorName: "Session Lead Snapshot",
      authorEmail: "session-lead@example.test",
      createdAt: now,
      updatedAt: now,
      ...sessionOverrides,
    },
    ...rowOverrides,
  };
}
