import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@customreport/ui';

type EmptyStateProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: {
    readonly label: string;
    readonly href: string;
  };
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 rounded-2xl bg-muted p-5">
        <Icon className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        {description}
      </p>
      {action ? (
        <Button asChild className="mt-6" size="lg">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
