import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import passport from "passport";
import type { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { PrismaClient, Role } from "@prisma/client";

import type { UserSession } from "@customreport/shared";

import type { createAuthController } from "./auth.controller.js";
import {
  createNullAuditLogger,
  type AuditLogger,
} from "../../lib/audit-logger.js";
import { loginAttemptsTotal } from "../../infrastructure/metrics/metrics.registry.js";

export type SamlProfile = {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
};

/**
 * Get Monday 00:00:00.000 UTC and Sunday 23:59:59.999 UTC for the week
 * containing `date`. UTC-only arithmetic — independent of host TZ and DST,
 * so the same call at 23:00 Moscow Sunday and 22:00 UTC Sunday produces
 * identical bounds. Phase 32-M7 (M-07) — fixes naive `setDate`/`setHours`
 * drift across DST transitions and TZ-mismatched containers.
 *
 * UFB-048 / Phase 50-A: when `periodLengthDays` is provided, `periodEnd`
 * is anchored to Monday + (length - 1) days at 23:59:59.999 UTC instead
 * of the hardcoded 7-day Mon-Sun span. Callers that don't pass the
 * argument keep the original Mon-Sun (length=7) behaviour.
 */
export function getCurrentWeekBounds(
  date: Date = new Date(),
  periodLengthDays = 7,
): {
  periodStart: Date;
  periodEnd: Date;
} {
  const utcDay = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Monday is the start-of-week. Sunday (0) maps to "6 days back".
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;

  const periodStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday,
      0,
      0,
      0,
      0,
    ),
  );
  const periodEnd = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday + (periodLengthDays - 1),
      23,
      59,
      59,
      999,
    ),
  );

  return { periodStart, periodEnd };
}

/**
 * Auto-create a draft report + sections for the current week if none exists.
 * Returns the created ReportSection for this lead, or null if user is not a lead.
 *
 * UFB-048 / Phase 50-A: reads `AppSettings.periodLengthDays` and
 * `AppSettings.defaultDeadlineDays` from the singleton row so admin
 * UI changes propagate to NEW periods immediately. Existing periods
 * are not recomputed — `findFirst` finds them first, no rewrite.
 *
 * The settings row is read inline via Prisma (no AdminService DI threading)
 * to keep `mountAuthRoutes`' signature surgical — the auth module already
 * holds a `PrismaClient` reference, and the singleton row is upserted on
 * read so callers never see "no settings yet" mid-boot.
 */
async function ensureWeeklyReport(
  prisma: PrismaClient,
  userId: string,
): Promise<{ reportId: string; sectionId: string } | null> {
  // UFB-048: load AppSettings singleton (upsert to materialise defaults on
  // first read). Falls back to schema defaults: periodLengthDays=7,
  // defaultDeadlineDays=4 — these match the Prisma defaults so a fresh
  // DB without UI-touched settings still produces a Mon-Sun week with
  // a Friday deadline, preserving pre-50-A behaviour.
  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
    select: { periodLengthDays: true, defaultDeadlineDays: true },
  });

  const { periodStart, periodEnd } = getCurrentWeekBounds(
    new Date(),
    settings.periodLengthDays,
  );

  // Create report for this week if it doesn't exist
  const existingReport = await prisma.report.findFirst({
    where: {
      status: "draft",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    select: { id: true },
  });

  let reportId: string;

  if (existingReport) {
    reportId = existingReport.id;
  } else {
    // UFB-048: deadline = periodStart + defaultDeadlineDays at 18:00 UTC.
    // The pre-50-A code computed periodEnd-2d=Fri at 15:00 local; the new
    // formula puts periodStart(Mon)+4d=Fri at 18:00 UTC for the default
    // value 4, matching the Friday end-of-day deadline shop teams expect.
    // The 18:00 hour is hardcoded until Phase 51 surfaces a setting for
    // deadline time-of-day (see plan 50-A AC).
    const deadline = new Date(periodStart);
    deadline.setUTCDate(deadline.getUTCDate() + settings.defaultDeadlineDays);
    deadline.setUTCHours(18, 0, 0, 0);

    const report = await prisma.report.create({
      data: { periodStart, periodEnd, deadline },
    });
    reportId = report.id;
  }

  // Ensure this lead has a section in the report
  const existingSection = await prisma.reportSection.findUnique({
    where: { reportId_authorId: { reportId, authorId: userId } },
    select: { id: true },
  });

  if (existingSection) {
    return { reportId, sectionId: existingSection.id };
  }

  // Create section + priorities + project statuses
  const projects = await prisma.project.findMany({
    where: { leadId: userId, archived: false },
    select: { id: true },
  });

  const section = await prisma.reportSection.create({
    data: { reportId, authorId: userId },
  });

  if (projects.length > 0) {
    const firstProject = projects.find(Boolean);
    const firstProjectId = firstProject?.id ?? "";
    await prisma.priority.createMany({
      data: [
        {
          reportSectionId: section.id,
          productId: firstProjectId,
          rank: 1,
          text: "Priority 1",
        },
        {
          reportSectionId: section.id,
          productId: firstProjectId,
          rank: 2,
          text: "Priority 2",
        },
        {
          reportSectionId: section.id,
          productId: firstProjectId,
          rank: 3,
          text: "Priority 3",
        },
      ],
    });
    await prisma.projectStatus.createMany({
      data: projects.map((p) => ({
        reportSectionId: section.id,
        projectId: p.id,
        status: "green" as const,
      })),
      skipDuplicates: true,
    });
  }

  return { reportId, sectionId: section.id };
}

export async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
): Promise<UserSession> {
  // Prefer email match (seed users may not have samlId), fall back to samlId
  const existing =
    (await prisma.user.findFirst({ where: { email: profile.email } })) ??
    (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));

  const needsOwningGroup =
    profile.role !== "viewer" && (!existing || !existing.reportingGroupId);
  const fallbackReportingGroup = needsOwningGroup
    ? ((await prisma.reportingGroup.findFirst({
        where: { archived: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await prisma.reportingGroup.upsert({
        where: { id: "a0000000-0000-4000-8000-000000000301" },
        create: {
          id: "a0000000-0000-4000-8000-000000000301",
          name: "Software Development",
          description: "Default reporting group for newly provisioned users",
          archived: false,
        },
        update: { archived: false },
        select: { id: true },
      })))
    : null;
  const nextReportingGroupId =
    profile.role === "viewer"
      ? null
      : (existing?.reportingGroupId ??
        fallbackReportingGroup?.id ??
        "a0000000-0000-4000-8000-000000000301");

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          samlId: profile.samlId,
          name: profile.displayName,
          role: profile.role,
          reportingGroupId: nextReportingGroupId,
        },
      })
    : await prisma.user.create({
        data: {
          samlId: profile.samlId,
          email: profile.email,
          name: profile.displayName,
          role: profile.role,
          reportingGroupId: nextReportingGroupId,
        },
      });

  const reportingGroup = user.reportingGroupId
    ? await prisma.reportingGroup.findUnique({
        where: { id: user.reportingGroupId },
        select: { name: true },
      })
    : null;

  // Lead users: find or auto-create their section in the active (draft) report
  let activeSection = await prisma.reportSection.findFirst({
    where: { authorId: user.id, report: { status: "draft" } },
    select: { id: true, reportId: true },
  });

  // Auto-create weekly report if lead has no active section
  if (!activeSection && user.role === "lead") {
    const created = await ensureWeeklyReport(prisma, user.id);
    if (created) {
      activeSection = { id: created.sectionId, reportId: created.reportId };
    }
  }

  // All roles: find the active report (head/viewer have no section but need the reportId)
  const activeReport = activeSection
    ? null
    : await prisma.report.findFirst({
        where: { status: "draft" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    activeReportId: activeSection?.reportId ?? activeReport?.id ?? null,
    activeReportSectionId: activeSection?.id ?? null,
    // UFB-040 / Phase 46-01: carry the user's owning ReportingGroup id in
    // the JWT so groupScopeFilter does not need a Prisma lookup per request.
    // viewer sessions may have no owning group; their visibility hydrates
    // through `viewerGroupAccess` lazily in trpc.context.
    reportingGroupId: user.reportingGroupId ?? undefined,
    reportingGroupName: reportingGroup?.name ?? undefined,
  };
}

export function mountAuthRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy,
  authController: ReturnType<typeof createAuthController>,
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
  auditLogger: AuditLogger = createNullAuditLogger(),
): void {
  const frontendUrl = env.FRONTEND_URL ?? "http://localhost:3000";

  // passport @types depend on express@4, project uses express@5 — cast required
  passport.use("saml", samlStrategy as unknown as passport.Strategy);

  // --- GET /auth/saml/login ---
  // In AUTH_DEV_MODE, short-circuit to /auth/dev-login as admin (no real
  // Keycloak running locally). Production registers the passport SAML
  // handler unchanged. Express picks the first registered route, so the
  // dev branch must be mounted BEFORE the passport handler — never both.
  if (env.AUTH_DEV_MODE === "true") {
    expressApp.get("/auth/saml/login", (req: Request, res: Response) => {
      const params = new URLSearchParams({
        role: "admin",
        email: "admin@customreport.local",
      });
      const next = typeof req.query.next === "string" ? req.query.next : null;
      if (next && next.startsWith("/") && !next.includes("://")) {
        params.set("redirect", next);
      }
      res.redirect(`/auth/dev-login?${params.toString()}`);
    });
  } else {
    expressApp.get(
      "/auth/saml/login",
      passport.initialize(),
      passport.authenticate("saml", { session: false }),
    );
  }

  // --- POST /auth/saml/callback ---
  expressApp.post(
    "/auth/saml/callback",
    express.urlencoded({ extended: false }),
    passport.initialize(),
    passport.authenticate("saml", {
      session: false,
      failureRedirect: `${frontendUrl}/auth/error?reason=invalid_assertion`,
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const profile = req.user as SamlProfile | undefined;

        if (!profile) {
          // AUTH-08: SAML callback hit without a passport-attached profile —
          // treat as login-fail (T2 mitigation: emit even when role/userId
          // are unknown so the audit trail captures the attempt).
          auditLogger.loginFail({
            userId: "anonymous",
            role: null,
            ip: req.ip ?? "unknown",
            reason: "invalid_assertion",
          });
          loginAttemptsTotal.inc({ method: "saml", outcome: "fail" });
          res.redirect(`${frontendUrl}/auth/error?reason=invalid_assertion`);
          return;
        }

        const session = await buildUserSession(prisma, profile);
        const { setCookieHeader } = authController.issueSessionCookie(session);

        // AUTH-08: structured login-success audit event.
        auditLogger.loginSuccess({
          userId: session.userId,
          role: session.role,
          ip: req.ip ?? "unknown",
        });
        loginAttemptsTotal.inc({ method: "saml", outcome: "success" });

        res.setHeader("Set-Cookie", setCookieHeader);
        res.redirect(frontendUrl);
      } catch (error) {
        // AUTH-08: any post-passport failure (DB write, JWT signing, etc.)
        // is still a failed login from the user's perspective.
        auditLogger.loginFail({
          userId: "anonymous",
          role: null,
          ip: req.ip ?? "unknown",
          reason: error instanceof Error ? error.message : "callback-error",
        });
        loginAttemptsTotal.inc({ method: "saml", outcome: "fail" });
        next(error);
      }
    },
  );

  // --- POST /auth/logout ---
  expressApp.post("/auth/logout", (request: Request, res: Response) => {
    // AUTH-08: emit logout audit event using whatever session shape was
    // attached upstream (passport-strategy or proxy middleware). When no
    // session is present, fall back to userId='anonymous' / role=null —
    // Phase 32-M8 (M-08) replaced the previous 'unknown' literal so SIEM
    // rules tuned to the Role enum (or to null = "no session") see the
    // anonymous logout case explicitly rather than as a fake "unknown
    // role" entry.
    const reqUser = (request as Request & { user?: UserSession }).user;
    auditLogger.logout({
      userId: reqUser?.userId ?? "anonymous",
      role: reqUser?.role ?? null,
      ip: request.ip ?? "unknown",
    });

    const cookieName = env.AUTH_JWT_COOKIE_NAME ?? "customreport_session";
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    res.redirect("/");
  });

  // --- GET /auth/dev-login (dev mode only) ---
  if (env.AUTH_DEV_MODE === "true") {
    expressApp.get(
      "/auth/dev-login",
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const role = (req.query.role as string) ?? "head";
          const validRoles: Role[] = ["lead", "head", "admin", "viewer"];
          if (!validRoles.includes(role as Role)) {
            loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
            res.status(400).json({
              error: `Invalid role: ${role}. Must be one of: ${validRoles.join(", ")}`,
            });
            return;
          }

          const emailByRole: Record<string, string> = {
            head: "head@customreport.local",
            lead: "lead1@customreport.local",
            admin: "admin@customreport.local",
            viewer: "viewer@customreport.local",
          };
          // Fallback names — only used when there is no DB record for the
          // email (fresh dev DB before seed has run). When a row exists, we
          // always use the seeded name so the session reflects the database.
          const nameByRole: Record<string, string> = {
            head: "Антон К.",
            lead: "Lead 1",
            admin: "Михаил Б.",
            viewer: "Дарья В.",
          };
          const samlIdByRole: Record<string, string> = {
            head: "head-1",
            lead: "lead-1",
            admin: "admin-1",
            viewer: "viewer-1",
          };

          // role was validated against `validRoles` above, so the lookup is
          // always defined — narrow explicitly to satisfy strict TS.
          const email =
            (req.query.email as string) ??
            emailByRole[role] ??
            `${role}@customreport.local`;
          const isCustomEmail =
            req.query.email && req.query.email !== emailByRole[role];

          // Always look up the live DB row first so re-seeds (or schema name
          // updates) propagate to the session cookie without a code change.
          const dbUser = await prisma.user.findFirst({
            where: { email },
            select: { name: true, samlId: true },
          });

          const samlId =
            dbUser?.samlId ??
            (isCustomEmail
              ? `dev-${email}`
              : (samlIdByRole[role] ?? `dev-${role}`));
          const displayName = dbUser?.name ?? nameByRole[role] ?? role;

          const session = await buildUserSession(prisma, {
            samlId,
            email,
            displayName,
            role: role as Role,
          });

          const { setCookieHeader } =
            authController.issueSessionCookie(session);
          res.setHeader("Set-Cookie", setCookieHeader);
          loginAttemptsTotal.inc({ method: "dev-login", outcome: "success" });

          // UX-16: role-aware default landing. Must stay in sync with
          // DEFAULT_FOR_ROLE in apps/web/src/app/page.tsx.
          const redirectByRole: Record<string, string> = {
            head: "/head/dashboard",
            lead: "/lead/report",
            admin: "/admin",
            viewer: "/reports?tab=published",
          };
          const redirectPath =
            (req.query.redirect as string) ?? redirectByRole[role] ?? "/";
          res.redirect(`${frontendUrl}${redirectPath}`);
        } catch (error) {
          loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
          next(error);
        }
      },
    );
  }
}
