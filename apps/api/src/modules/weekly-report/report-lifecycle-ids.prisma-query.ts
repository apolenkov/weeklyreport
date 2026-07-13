import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * Report-lifecycle id lookups, split out of `WeeklyReportPrismaRepository`
 * to keep that file under the line budget.
 */

export async function queryActiveReportId(
  prisma: PrismaService,
): Promise<string | null> {
  // Exclude scheduled-future periods: their periodStatus defaults to "open"
  // (the PeriodStatus enum has no "scheduled" value), so a future period
  // would otherwise win the periodStart-desc ordering and be mis-picked as
  // the current period. Requiring periodStart <= now returns the most recent
  // open/reopened period that has actually started.
  const editableReport = await prisma.report.findFirst({
    where: {
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { lte: new Date() },
    },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });

  if (editableReport) {
    return editableReport.id;
  }

  const publishedReport = await prisma.report.findFirst({
    where: { periodStatus: "published" },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });

  return publishedReport?.id ?? null;
}

/**
 * viewer-live-status (Decision 0): the single source of truth for the
 * **current editable period** — the newest non-archived `open`/`reopened`
 * report that has actually started (`periodStart <= now`). Deliberately:
 *   - NO published fallback (unlike `queryActiveReportId`): the viewer gate
 *     already admits any `published` report via its first clause, so a
 *     fallback here would let the gate's id-equality match a published id and
 *     defeat the `open → published` race rejection.
 *   - `archived: false`: the admin archive path does not force `periodStatus`,
 *     so an archived row can still read `open`; a `Current period` is
 *     non-archived (CONTEXT.md), and excluding archived rows keeps an
 *     archived-open period from being mistaken for the current one.
 *
 * Determinism (Decision 3): the period-creation lock is a separate change, so
 * two concurrent editable periods can share the same `periodStart`. A
 * `periodStart desc` sort alone leaves that tie to the DB's arbitrary row
 * order — and because the gate and the `latestForViewer` resolver call this
 * helper SEPARATELY, a nondeterministic tie could let them pick DIFFERENT
 * periods (the resolver targets one, the gate authorizes the other → the
 * viewer's own Status entry 404s). The secondary `id desc` key is a total,
 * stable order over the unique primary key, so every call resolves the same
 * id for the same data.
 */
export async function queryCurrentEditableId(
  prisma: PrismaService,
): Promise<string | null> {
  const editableReport = await prisma.report.findFirst({
    where: {
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { lte: new Date() },
      archived: false,
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return editableReport?.id ?? null;
}

/**
 * viewer-live-status: the newest `published` report id. Used as the viewer's
 * default-report fallback when no current editable period exists, so the
 * resolved default is a period the published-or-current gate accepts. The
 * `id desc` tiebreak keeps the pick deterministic on a shared `periodStart`.
 */
export async function queryLatestPublishedId(
  prisma: PrismaService,
): Promise<string | null> {
  const publishedReport = await prisma.report.findFirst({
    where: { periodStatus: "published" },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return publishedReport?.id ?? null;
}

/**
 * The newest non-archived `published` report id. Mirrors
 * `queryLatestPublishedId` but adds `archived: false`, so it is the head's
 * `period.reopen` authz target and published-fallback default: a head can
 * reopen the newest non-archived published period even when a newer published
 * row has since been archived (the archived-rejection guard would otherwise
 * block it). The `id desc` tiebreak keeps the pick deterministic on a shared
 * `periodStart`.
 */
export async function queryLatestPublishedNonArchivedId(
  prisma: PrismaService,
): Promise<string | null> {
  const publishedReport = await prisma.report.findFirst({
    where: { periodStatus: "published", archived: false },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return publishedReport?.id ?? null;
}
