'use client';

import { CheckCircle2, Clock, Users } from 'lucide-react';

import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
} from '@customreport/ui';

import { formatDateTime } from '../../lib/format-date';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

type SubmissionDashboardProps = {
  rows: SubmissionDashboardRow[];
};

export function SubmissionDashboard({ rows }: SubmissionDashboardProps) {
  const parsedRows = submissionDashboardRowSchema.array().parse(rows);

  if (parsedRows.length === 0) {
    return (
      <div className="flex animate-fade-in flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-base text-muted-foreground">No leads assigned to this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Lead Submissions</h2>
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parsedRows.map((row) => {
          const isSubmitted = row.status === 'submitted';

          return (
            <Card
              key={row.leadId}
              className={`transition-all hover:shadow-md ${
                isSubmitted ? 'border-success/30 bg-success/5' : ''
              }`}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <Avatar className="mt-0.5 size-12 shrink-0 border">
                  <AvatarFallback className={`text-base font-semibold ${
                    isSubmitted ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {getInitials(row.leadName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold">{row.leadName}</span>
                    {isSubmitted ? (
                      <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Clock className="h-5 w-5" />
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.projectNames.join(' · ')}
                  </p>
                  {row.submittedAt ? (
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(row.submittedAt)}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
