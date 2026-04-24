import { History, Layers3, Server } from 'lucide-react';

import { EmptyState } from './empty-state';

type ApiReadinessPlaceholderProps = {
  readonly pageTitle: string;
};

export function ApiReadinessPlaceholder({
  pageTitle,
}: ApiReadinessPlaceholderProps) {
  return (
    <div className="animate-fade-in space-y-8">
      <EmptyState
        icon={Server}
        title={`${pageTitle} is temporarily stubbed`}
        description="The approved mockups are ahead of the API. We are holding the real screen implementation until the backend contracts, review workflow, and history/versioning semantics are completed end-to-end."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 inline-flex rounded-full bg-muted p-2">
            <Layers3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold tracking-tight">
            Product-centric contracts
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Product status pipelines, stage ownership, current and next week
            items, risks, decisions, and priorities are being aligned to the
            mockups first.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 inline-flex rounded-full bg-muted p-2">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold tracking-tight">
            Review and history workflow
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Head review, explicit approval before publish, immutable archive,
            and version history are being formalized in the API plan before the
            UI comes back.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 inline-flex rounded-full bg-muted p-2">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold tracking-tight">
            Navigation stays available
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The app shell remains visible so route structure and role navigation
            can still be reviewed while implementation is paused.
          </p>
        </div>
      </div>
    </div>
  );
}
