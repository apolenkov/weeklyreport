import { randomUUID } from "node:crypto";

import { type Api, sleep } from "./scenario-api.ts";

type Json = Readonly<Record<string, unknown>>;
type Section = Readonly<{
  reportSectionId: string;
  reportId: string;
  authorId: string;
  version: number;
  status: string;
  projects: readonly Json[];
  activities: readonly Json[];
  items: readonly Json[];
  risks: readonly Json[];
  decisions: readonly Json[];
}>;
type FormRead = Readonly<{ section: Section }>;

/** The active period of the demo seed and the lead who owns its prepared section. */
const ACTIVE_REPORT = "a0000000-0000-4000-8000-000000000001";
const REOPEN_REQUEST = "a0000000-0000-4000-8000-000000000d01";
const DEADLINE_RULE = "a0000000-0000-4000-8000-000000000801";

type Stage = Readonly<{ stageId: string; stageName: string; status: string }>;

const stagesOf = (project: Json): readonly Stage[] =>
  project.ownedStages as readonly Stage[];

const pick = (row: Json, keys: readonly string[]): Json =>
  Object.fromEntries(keys.filter((key) => key in row).map((k) => [k, row[k]]));

const ITEM_FIELDS = [
  "id",
  "stableId",
  "projectId",
  "activityId",
  "type",
  "text",
  "tag",
  "workflowStatus",
  "carriedOver",
  "priorityRank",
  "pausedReason",
  "nextStepText",
  "stageNames",
];
const RISK_FIELDS = [
  "id",
  "stableId",
  "projectId",
  "activityId",
  "risk",
  "impact",
  "mitigation",
  "severity",
  "stageNames",
];
const DECISION_FIELDS = [
  "id",
  "stableId",
  "text",
  "owner",
  "deadline",
  "impact",
  "resolvedAt",
  "stageNames",
  "productId",
  "activityId",
];
const TEXT_ROOM = 400;

/** Items of the form; an edit appends to the first one, a submission confirms the carried-over ones. */
function formItems(section: Section, edited: boolean): readonly Json[] {
  const items: readonly Json[] = section.items.map((item, index) => ({
    ...pick(item, ITEM_FIELDS),
    ...(edited ? {} : { carriedOver: false }),
    ...(edited && index === 0
      ? { text: `${String(item.text).slice(0, TEXT_ROOM)} (scenario edit)` }
      : {}),
  }));
  // submitting needs a Current item for every product
  const covered = new Set(
    items.filter((item) => item.type === "current").map((i) => i.projectId),
  );
  const added = section.projects
    .filter((project) => !covered.has(project.projectId))
    .map((project) => ({
      projectId: project.projectId,
      type: "current",
      text: "Scenario progress item",
      tag: "feature",
      workflowStatus: "in_progress",
      stageNames: stagesOf(project)
        .slice(0, 1)
        .map((stage) => stage.stageName),
    }));
  return [...items, ...added];
}

/** The form the lead has, as the save and submit inputs describe it. */
function formInput(section: Section, edited: boolean): Json {
  return {
    reportSectionId: section.reportSectionId,
    version: section.version,
    status: "draft",
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight,
    })),
    stageStatuses: section.projects.flatMap((project) =>
      stagesOf(project).map((stage) => ({
        projectId: project.projectId,
        stageId: stage.stageId,
        status: stage.status,
      })),
    ),
    activityStatuses: section.activities.map((activity) =>
      pick(activity, ["activityId", "status", "titleOverride", "note"]),
    ),
    items: formItems(section, edited),
    risks: section.risks.map((risk) => pick(risk, RISK_FIELDS)),
    decisions: section.decisions.map((decision) =>
      pick(decision, DECISION_FIELDS),
    ),
    confirmed: true,
  };
}

function readSection(
  api: Api,
  role: "lead" | "head",
  authorId?: string,
): Section | undefined {
  return (
    api.as(role).query("read the form", "leadForm.byPeriod", {
      reportId: ACTIVE_REPORT,
      ...(authorId ? { authorId } : {}),
    }).data as FormRead | undefined
  )?.section;
}

function submitAgain(api: Api, step: string): Section | undefined {
  const section = readSection(api, "lead");
  if (!section) return undefined;
  api.as("lead").mutate(step, "reports.submit", formInput(section, false));
  return readSection(api, "lead");
}

/** Plan outcomes on the lead's open section: cancel and restore an item, continue one with a next step, promote that step. */
function planOutcomes(api: Api): void {
  const lead = api.as("lead");
  const current = (): Section | undefined => readSection(api, "lead");
  const items = current()?.items.filter((item) => item.type === "current");
  const [cancelled, continued] = items ?? [];
  if (!cancelled || !continued) return;
  const command = (section: Section): Json => ({
    reportSectionId: section.reportSectionId,
    version: section.version,
    commandId: randomUUID(),
  });
  let section = current();
  if (!section) return;
  lead.mutate("cancel an item", "leadForm.resolvePlan", {
    ...command(section),
    source: { kind: "current", recordId: cancelled.id },
    outcome: "wont_do",
    reason: "Scenario: cancelled",
  });
  section = current();
  if (!section) return;
  lead.mutate("restore the item", "leadForm.restorePlan", {
    ...command(section),
    recordId: cancelled.id,
  });
  section = current();
  if (!section) return;
  lead.mutate("continue an item", "leadForm.resolvePlan", {
    ...command(section),
    source: { kind: "current", recordId: continued.id },
    outcome: "continue",
    nextStepText: "Scenario next step",
  });
  section = current();
  if (!section) return;
  lead.mutate("promote the next step", "leadForm.promotePlan", {
    ...command(section),
    recordId: continued.id,
  });
}

/**
 * The report lifecycle across roles on the demo seed: the admin sends the lead's section back, the lead
 * saves it, submits it and works its plan, the head reviews and revokes, the lead submits again, and the
 * head publishes, reopens, archives and exports the period.
 */
export function reportScenario(api: Api): void {
  const admin = api.as("admin");
  const lead = api.as("lead");
  const head = api.as("head");
  admin.mutate("send the section back", "admin.respondReopenRequest", {
    id: REOPEN_REQUEST,
    decision: "approved",
    note: "scenario",
  });
  const draft = readSection(api, "lead");
  if (!draft) throw new Error("the lead's form is not readable");
  lead.mutate("save the draft", "reports.saveDraft", formInput(draft, true));
  const saved = submitAgain(api, "submit the report");
  const submitted = readSection(api, "head", draft.authorId);
  if (!saved || !submitted) return;
  const comment = head.mutate("comment on an item", "review.comment", {
    itemId: submitted.items[0]?.id,
    text: "Scenario comment",
  }).data as Json | undefined;
  if (typeof comment?.id === "string")
    head.mutate("delete the comment", "review.deleteComment", {
      commentId: comment.id,
    });
  head.mutate("revoke the submission", "leadForm.revoke", {
    reportSectionId: submitted.reportSectionId,
  });
  planOutcomes(api);
  submitAgain(api, "submit again");
  head.mutate("revoke every submission", "leadForm.revokeAllSubmitted", {
    reportId: ACTIVE_REPORT,
  });
  submitAgain(api, "submit once more");
  lead.mutate("ask to reopen", "leadForm.requestReopen", {
    reportSectionId: draft.reportSectionId,
    reason: "Scenario: a late correction",
  });
  answerReopenRequests(api);
  head.query("read the assembled report", "review.assembledReport");
  head.query("read the telemetry summary", "telemetry.summary");
  // the stand has no AI provider: the assistant answers that it is not configured
  lead.mutate("ask the assistant", "leadForm.assistant", {
    question: "What is blocked this week?",
    resolutionTokens: [],
  });
  head.mutate("send the reminders", "reminders.dispatchPending", {
    reportId: ACTIVE_REPORT,
    ruleId: DEADLINE_RULE,
  });
  head.query("list the reminder executions", "reminders.listExecutions", {
    ruleId: DEADLINE_RULE,
  });
  lead.query("search the reports", "search.query", {
    q: "OAuth",
    scope: "mine",
    limit: 5,
  });
  publishAndExport(api);
}

function answerReopenRequests(api: Api): void {
  const admin = api.as("admin");
  const pending = (
    admin.query("list the reopen requests", "admin.listReopenRequests").data as
      Readonly<{ items: readonly Json[] }> | undefined
  )?.items.filter((request) => request.status === "pending");
  for (const request of pending ?? [])
    admin.mutate("answer a reopen request", "admin.respondReopenRequest", {
      id: request.id,
      decision: "rejected",
      note: "scenario",
    });
}

const EXPORT_POLLS = 20;
const EXPORT_POLL_MS = 3000;

/** Publish, export to PDF (the web server then reads the print gate and the render input), archive, unarchive, reopen. */
function publishAndExport(api: Api): void {
  const head = api.as("head");
  head.mutate("publish the period", "period.publish", {
    reportId: ACTIVE_REPORT,
  });
  const job = head.mutate("request a PDF export", "pdfExport.request", {
    reportId: ACTIVE_REPORT,
  }).data as Readonly<{ jobId?: string }> | undefined;
  for (let poll = 0; job?.jobId && poll < EXPORT_POLLS; poll += 1) {
    const state = head.query("poll the export", "pdfExport.status", {
      jobId: job.jobId,
    }).data as Readonly<{ status?: string }> | undefined;
    if (state?.status === "completed" || state?.status === "failed") break;
    sleep(EXPORT_POLL_MS);
  }
  head.query("list the archive", "archive.list", { limit: 10 });
  head.mutate("archive the report", "archive.archiveReport", {
    reportId: ACTIVE_REPORT,
  });
  head.query("read the archived report", "archive.detail", {
    reportId: ACTIVE_REPORT,
  });
  head.mutate("unarchive the report", "archive.unarchiveReport", {
    reportId: ACTIVE_REPORT,
  });
  head.mutate("reopen the period", "period.reopen", {
    reportId: ACTIVE_REPORT,
  });
}
