import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import passport from 'passport';
import type { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import type { PrismaClient } from '@prisma/client';

import type { UserSession } from '@customreport/shared';

import type { createAuthController } from './auth.controller.js';
import {
  createNullAuditLogger,
  type AuditLogger,
} from '../../lib/audit-logger.js';

type SamlProfile = {
  samlId: string;
  email: string;
  displayName: string;
  role: string;
};

/**
 * Get Monday 00:00 and Sunday 23:59:59 for the week containing `date`.
 */
function getCurrentWeekBounds(date: Date = new Date()): { periodStart: Date; periodEnd: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { periodStart: monday, periodEnd: sunday };
}

/**
 * Auto-create a draft report + sections for the current week if none exists.
 * Returns the created ReportSection for this lead, or null if user is not a lead.
 */
async function ensureWeeklyReport(
  prisma: PrismaClient,
  userId: string,
): Promise<{ reportId: string; sectionId: string } | null> {
  const { periodStart, periodEnd } = getCurrentWeekBounds();

  // Create report for this week if it doesn't exist
  const existingReport = await prisma.report.findFirst({
    where: { status: 'draft', periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
    select: { id: true },
  });

  let reportId: string;

  if (existingReport) {
    reportId = existingReport.id;
  } else {
    const deadline = new Date(periodEnd);
    deadline.setDate(deadline.getDate() - 2); // Friday
    deadline.setHours(15, 0, 0, 0);

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
    data: {
      reportId,
      authorId: userId,
      priorities: {
        createMany: {
          data: [
            { rank: 1, text: 'Priority 1' },
            { rank: 2, text: 'Priority 2' },
            { rank: 3, text: 'Priority 3' },
          ],
        },
      },
    },
  });

  if (projects.length > 0) {
    await prisma.projectStatus.createMany({
      data: projects.map((p) => ({
        reportSectionId: section.id,
        projectId: p.id,
        status: 'green' as const,
      })),
      skipDuplicates: true,
    });
  }

  return { reportId, sectionId: section.id };
}

async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
): Promise<UserSession> {
  // Prefer email match (seed users may not have samlId), fall back to samlId
  const existing =
    (await prisma.user.findFirst({ where: { email: profile.email } })) ??
    (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { samlId: profile.samlId, name: profile.displayName },
      })
    : await prisma.user.create({
        data: {
          samlId: profile.samlId,
          email: profile.email,
          name: profile.displayName,
          role: profile.role as 'lead' | 'head' | 'viewer',
        },
      });

  // Lead users: find or auto-create their section in the active (draft) report
  let activeSection = await prisma.reportSection.findFirst({
    where: { authorId: user.id, report: { status: 'draft' } },
    select: { id: true, reportId: true },
  });

  // Auto-create weekly report if lead has no active section
  if (!activeSection && user.role === 'lead') {
    const created = await ensureWeeklyReport(prisma, user.id);
    if (created) {
      activeSection = { id: created.sectionId, reportId: created.reportId };
    }
  }

  // All roles: find the active report (head/viewer have no section but need the reportId)
  const activeReport = activeSection
    ? null
    : await prisma.report.findFirst({
        where: { status: 'draft' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    activeReportId: activeSection?.reportId ?? activeReport?.id ?? null,
    activeReportSectionId: activeSection?.id ?? null,
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
  const frontendUrl = env.FRONTEND_URL ?? 'http://localhost:3000';

  // passport @types depend on express@4, project uses express@5 — cast required
  passport.use('saml', samlStrategy as unknown as passport.Strategy);

  // --- GET /auth/saml/login ---
  expressApp.get(
    '/auth/saml/login',
    passport.initialize(),
    passport.authenticate('saml', { session: false }),
  );

  // --- POST /auth/saml/callback ---
  expressApp.post(
    '/auth/saml/callback',
    express.urlencoded({ extended: false }),
    passport.initialize(),
    passport.authenticate('saml', { session: false, failureRedirect: `${frontendUrl}/auth/error?reason=invalid_assertion` }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const profile = req.user as SamlProfile | undefined;

        if (!profile) {
          // AUTH-08: SAML callback hit without a passport-attached profile —
          // treat as login-fail (T2 mitigation: emit even when role/userId
          // are unknown so the audit trail captures the attempt).
          auditLogger.loginFail({
            userId: 'anonymous',
            role: 'unknown',
            ip: req.ip ?? 'unknown',
            reason: 'invalid_assertion',
          });
          res.redirect(`${frontendUrl}/auth/error?reason=invalid_assertion`);
          return;
        }

        const session = await buildUserSession(prisma, profile);
        const { setCookieHeader } = authController.issueSessionCookie(session);

        // AUTH-08: structured login-success audit event.
        auditLogger.loginSuccess({
          userId: session.userId,
          role: session.role,
          ip: req.ip ?? 'unknown',
        });

        res.setHeader('Set-Cookie', setCookieHeader);
        res.redirect(frontendUrl);
      } catch (error) {
        // AUTH-08: any post-passport failure (DB write, JWT signing, etc.)
        // is still a failed login from the user's perspective.
        auditLogger.loginFail({
          userId: 'anonymous',
          role: 'unknown',
          ip: req.ip ?? 'unknown',
          reason: error instanceof Error ? error.message : 'callback-error',
        });
        next(error);
      }
    },
  );

  // --- POST /auth/logout ---
  expressApp.post('/auth/logout', (request: Request, res: Response) => {
    // AUTH-08: emit logout audit event using whatever session shape was
    // attached upstream (passport-strategy or proxy middleware). When no
    // session is present, fall back to anonymous/unknown — same defensive
    // shape as login-fail to keep the audit trail consistent.
    const reqUser = (request as Request & { user?: UserSession }).user;
    auditLogger.logout({
      userId: reqUser?.userId ?? 'anonymous',
      role: reqUser?.role ?? 'unknown',
      ip: request.ip ?? 'unknown',
    });

    const cookieName = env.AUTH_JWT_COOKIE_NAME ?? 'customreport_session';
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    res.redirect('/');
  });

  // --- GET /auth/dev-login (dev mode only) ---
  if (env.AUTH_DEV_MODE === 'true') {
    expressApp.get('/auth/dev-login', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const role = (req.query.role as string) ?? 'head';
        const validRoles = ['lead', 'head', 'viewer'];
        if (!validRoles.includes(role)) {
          res.status(400).json({ error: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}` });
          return;
        }

        const emailByRole: Record<string, string> = {
          head: 'head@customreport.local',
          lead: 'lead1@customreport.local',
          viewer: 'viewer@customreport.local',
        };
        const nameByRole: Record<string, string> = {
          head: 'Department Head',
          lead: 'Lead 1',
          viewer: 'Report Viewer',
        };
        const samlIdByRole: Record<string, string> = {
          head: 'head-1',
          lead: 'lead-1',
          viewer: 'viewer-1',
        };

        const email = (req.query.email as string) ?? emailByRole[role]!;

        // Derive samlId and displayName from email when custom email is provided
        const isCustomEmail = req.query.email && req.query.email !== emailByRole[role];
        const samlId = isCustomEmail ? `dev-${email}` : (samlIdByRole[role] ?? `dev-${role}`);
        const displayName = isCustomEmail
          ? (await prisma.user.findFirst({ where: { email }, select: { name: true } }))?.name ?? email
          : (nameByRole[role] ?? role);

        const session = await buildUserSession(prisma, {
          samlId,
          email,
          displayName,
          role,
        });

        const { setCookieHeader } = authController.issueSessionCookie(session);
        res.setHeader('Set-Cookie', setCookieHeader);

        const redirectByRole: Record<string, string> = {
          head: '/admin',
          lead: '/lead/report',
          viewer: '/reports/history',
        };
        const redirectPath = (req.query.redirect as string) ?? redirectByRole[role] ?? '/';
        res.redirect(`${frontendUrl}${redirectPath}`);
      } catch (error) {
        next(error);
      }
    });
  }
}
