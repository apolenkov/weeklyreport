import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import passport from 'passport';
import type { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import type { PrismaClient } from '@prisma/client';

import type { UserSession } from '@customreport/shared';

import type { createAuthController } from './auth.controller.js';

type SamlProfile = {
  samlId: string;
  email: string;
  displayName: string;
  role: string;
};

const userInclude = {
  authoredReportSections: {
    where: { report: { status: 'draft' as const } },
    select: { id: true, reportId: true },
    take: 1,
  },
};

async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
): Promise<UserSession> {
  // Find by email first (seed users may not have samlId), then by samlId
  const existing = await prisma.user.findFirst({
    where: { OR: [{ samlId: profile.samlId }, { email: profile.email }] },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { samlId: profile.samlId, email: profile.email, name: profile.displayName },
        include: userInclude,
      })
    : await prisma.user.create({
        data: {
          samlId: profile.samlId,
          email: profile.email,
          name: profile.displayName,
          role: profile.role as 'lead' | 'head' | 'viewer',
        },
        include: userInclude,
      });

  const activeSection = user.authoredReportSections[0] ?? null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    activeReportId: activeSection?.reportId ?? null,
    activeReportSectionId: activeSection?.id ?? null,
  };
}

export function mountAuthRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy,
  authController: ReturnType<typeof createAuthController>,
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
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
          res.redirect(`${frontendUrl}/auth/error?reason=invalid_assertion`);
          return;
        }

        const session = await buildUserSession(prisma, profile);
        const { setCookieHeader } = authController.issueSessionCookie(session);

        res.setHeader('Set-Cookie', setCookieHeader);
        res.redirect(frontendUrl);
      } catch (error) {
        next(error);
      }
    },
  );

  // --- POST /auth/logout ---
  expressApp.post('/auth/logout', (_request: Request, res: Response) => {
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
        const displayName = nameByRole[role] ?? role;
        const samlId = samlIdByRole[role] ?? `dev-${role}`;

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
