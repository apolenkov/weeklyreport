import type { Role } from "@weeklyreport/shared";
import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@weeklyreport/ui/components/ui/card";
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
            You do not have access to this page.
            {/* C5224: an empty list has no role to name, and the sentence read
                "available to the  role only". */}
            {requiredRoles.length > 0
              ? ` It is available to the ${rolesLabel} role only; your home page lists what your role can open.`
              : " Your home page lists what your role can open."}
          </p>
          <Button asChild>
            <Link href={homeHref}>Go to my home page</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
