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

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-[28px] font-semibold leading-[1.2]">
            CustomReport
          </CardTitle>
          <CardDescription>
            Weekly status reporting system
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {IS_DEV ? (
            <>
              <Button variant="default" className="w-full" asChild>
                <a href="/auth/dev-login?role=head">Sign In as Head</a>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a href="/auth/dev-login?role=lead">Sign In as Lead</a>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <a href="/auth/dev-login?role=viewer">Sign In as Viewer</a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Development mode — choose a role
              </p>
            </>
          ) : (
            <>
              <Button variant="default" className="w-full" asChild>
                <a href={SAML_LOGIN_URL}>Sign In</a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Sign in with your corporate account
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
