import type { Role } from "@customreport/shared";
import { Button } from "@customreport/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@customreport/ui/components/ui/card";
import Link from "next/link";

// Only requiredRoles is rendered — the viewer's own role is withheld so
// protected routes cannot be used to enumerate role state.
export interface ForbiddenPageProps {
  readonly requiredRoles: readonly Role[];
  readonly homeHref: string;
}

export function ForbiddenPage({ requiredRoles, homeHref }: ForbiddenPageProps) {
  const rolesLabel = requiredRoles.join(" or ");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <Card className="max-w-md">
        <CardHeader>
          <h1 className="leading-none font-semibold">
            Page unavailable for your role
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page is reserved for the {rolesLabel} role. Head back to the
            dashboard to continue.
          </p>
          <Button asChild>
            <Link href={homeHref}>Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
