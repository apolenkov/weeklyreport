import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@customreport/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
          <Button variant="default" className="w-full" asChild>
            <a href={`${API_URL}/auth/saml/login`}>Sign In</a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Sign in with your corporate account
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
