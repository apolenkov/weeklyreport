import type { Role } from "@customreport/shared";
import { Button } from "@customreport/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@customreport/ui/components/ui/card";
import Link from "next/link";

/**
 * Shared 403 page composed into each (app)/route-group layout when the SSR
 * role check fails.
 *
 * Only `requiredRoles` is rendered into the DOM. The user's actual role is
 * intentionally NOT displayed, so a hostile viewer cannot enumerate role
 * state by hitting protected routes. `homeHref` is a pre-resolved path the
 * caller computes from the session (via `roleHomePath`, or `/` for
 * anonymous), keeping this component role-agnostic.
 */
export interface ForbiddenPageProps {
  readonly requiredRoles: readonly Role[];
  readonly homeHref: string;
}

export function ForbiddenPage({ requiredRoles, homeHref }: ForbiddenPageProps) {
  const rolesLabel = requiredRoles.join(" or ");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Page unavailable for your role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page is reserved for the {rolesLabel} role. Switch role from
            the dev role switcher in the top navigation to continue, or head
            back to the dashboard.
          </p>
          <Button asChild>
            <Link href={homeHref}>Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
