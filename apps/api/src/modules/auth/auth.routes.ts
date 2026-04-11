import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import passport from 'passport';
import type { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import type { PrismaClient } from '@prisma/client';

import type { UserSession } from '@customreport/shared';

import type { createAuthController } from './auth.controller.js';

const DEV_SESSION_SAML_ID = 'dev-head-saml-id';
const DEV_SESSION_EMAIL = 'head@customreport.local';
const DEV_SESSION_NAME = 'Department Head';

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
    res.setHeader(
      'Set-Cookie',
      'customreport_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    );
    res.redirect('/');
  });

  // --- GET /auth/dev-login (dev mode only) ---
  if (env.AUTH_DEV_MODE === 'true') {
    expressApp.get('/auth/dev-login', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await buildUserSession(prisma, {
          samlId: DEV_SESSION_SAML_ID,
          email: DEV_SESSION_EMAIL,
          displayName: DEV_SESSION_NAME,
          role: 'head',
        });

        const { setCookieHeader } = authController.issueSessionCookie(session);

        res.setHeader('Set-Cookie', setCookieHeader);
        res.redirect(frontendUrl);
      } catch (error) {
        next(error);
      }
    });
  }
}
