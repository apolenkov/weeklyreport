import { BarChart3, FileText, Shield, Users } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@customreport/ui';

const IS_DEV = process.env.AUTH_DEV_MODE === 'true' || process.env.NODE_ENV !== 'production';
const SAML_LOGIN_URL = '/auth/saml/login';

const features = [
  {
    icon: FileText,
    title: 'Structured Reports',
    description: 'Traffic lights, priorities, risks — all in one place',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: '6 leads fill sections independently, no conflicts',
  },
  {
    icon: BarChart3,
    title: 'Analytics & History',
    description: 'Track trends across weeks, export to PDF',
  },
  {
    icon: Shield,
    title: 'Enterprise SSO',
    description: 'Secure SAML authentication via Keycloak',
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-svh">
      {/* Left panel — branded */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[oklch(0.22_0.06_260)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, oklch(0.75 0.15 70 / 0.4), transparent 60%), radial-gradient(ellipse at 70% 80%, oklch(0.55 0.18 260 / 0.3), transparent 60%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.75_0.15_70)] font-semibold text-[oklch(0.15_0.03_260)]">
              CR
            </div>
            <span className="text-xl font-semibold text-white">CustomReport</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Weekly status reports,
            <br />
            <span className="text-[oklch(0.75_0.15_70)]">simplified.</span>
          </h1>
          <p className="max-w-md text-lg text-[oklch(0.7_0.01_260)]">
            Collect, review, and publish department reports with structure, clarity, and zero editing conflicts.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-[oklch(0.3_0.06_260)] bg-[oklch(0.18_0.05_260)]/60 p-4 backdrop-blur-sm"
            >
              <feature.icon className="mb-2 h-5 w-5 text-[oklch(0.75_0.15_70)]" />
              <p className="text-sm font-medium text-white">{feature.title}</p>
              <p className="mt-1 text-sm text-[oklch(0.6_0.01_260)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
            CR
          </div>
          <span className="text-xl font-semibold">CustomReport</span>
        </div>

        <Card className="w-full max-w-sm animate-fade-in border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Welcome back
            </CardTitle>
            <CardDescription className="text-sm">
              Sign in to access your reports
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {IS_DEV ? (
              <>
                <div className="flex w-full flex-col gap-2">
                  <Button size="lg" className="w-full gap-2" asChild>
                    <a href="/auth/dev-login?role=head">
                      <Shield className="h-5 w-5" />
                      Sign In as Head
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full gap-2" asChild>
                    <a href="/auth/dev-login?role=lead">
                      <FileText className="h-5 w-5" />
                      Sign In as Lead
                    </a>
                  </Button>
                  <Button size="lg" variant="ghost" className="w-full gap-2" asChild>
                    <a href="/auth/dev-login?role=viewer">
                      <Users className="h-5 w-5" />
                      Sign In as Viewer
                    </a>
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">Development mode</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : (
              <>
                <Button size="lg" className="w-full" asChild>
                  <a href={SAML_LOGIN_URL}>Sign In with SSO</a>
                </Button>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Sign in with your corporate Keycloak account
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Development Department · Weekly Reporting System
        </p>
      </div>
    </main>
  );
}
