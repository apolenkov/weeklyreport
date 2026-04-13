'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListOrdered,
  Send,
  Target,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  type DraftSavePayload,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
} from '@customreport/ui';

import { AutosaveIndicator } from './autosave-indicator';
import { DecisionsEditor } from './decisions-editor';
import { ItemsEditor } from './items-editor';
import { PrioritiesEditor } from './priorities-editor';
import { ProjectStatusGrid } from './project-status-grid';
import { RisksEditor } from './risks-editor';

type ReportSectionFormProps = {
  initialSection: ReportSectionReadModel;
  onSaveDraft: (input: DraftSavePayload) => Promise<ReportSectionReadModel>;
  onSubmit: (input: SubmitSectionPayload) => Promise<ReportSectionReadModel>;
};

function toDraftSaveInput(section: ReportSectionReadModel): DraftSavePayload {
  return {
    reportSectionId: section.reportSectionId,
    status: section.status,
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight ?? undefined,
    })),
    items: section.items,
    risks: section.risks,
    decisions: section.decisions,
    priorities: section.priorities,
  };
}

function toSubmitInput(section: ReportSectionReadModel): SubmitSectionPayload {
  return {
    ...toDraftSaveInput(section),
    confirmed: true,
    projectStatuses: section.projects
      .filter((p) => p.trafficLight != null)
      .map((p) => ({
        projectId: p.projectId,
        status: p.trafficLight!,
      })),
    priorities: section.priorities,
  };
}

function replaceSectionProjectLight(
  section: ReportSectionReadModel,
  projectId: string,
  trafficLight: 'green' | 'yellow' | 'red' | '',
): ReportSectionReadModel {
  return {
    ...section,
    projects: section.projects.map((project) =>
      project.projectId === projectId
        ? { ...project, trafficLight: trafficLight || null }
        : project,
    ),
  };
}

function collectValidationMessages(section: ReportSectionReadModel): string[] {
  const errors: string[] = [];

  for (const project of section.projects) {
    if (!project.trafficLight) {
      errors.push(`Project ${project.projectName} must have a traffic light status.`);
    }

    const hasCurrentItem = section.items.some(
      (item) => item.projectId === project.projectId && item.type === 'current',
    );

    if (!hasCurrentItem) {
      errors.push(`Project ${project.projectName} needs at least one Current Week item.`);
    }
  }

  if (
    section.priorities.length !== 3 ||
    section.priorities.some((priority) => priority.text.trim().length === 0)
  ) {
    errors.push('Top 3 priorities must be filled before submit.');
  }

  return errors;
}

export function ReportSectionForm({
  initialSection,
  onSaveDraft,
  onSubmit,
}: ReportSectionFormProps) {
  const [section, setSection] = useState(initialSection);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const isFirstRender = useRef(true);
  const lastSavedSnapshot = useRef(JSON.stringify(toDraftSaveInput(initialSection)));

  const isReadOnly = section.status === 'submitted';

  useEffect(() => {
    const currentSnapshot = JSON.stringify(toDraftSaveInput(section));

    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedSnapshot.current = currentSnapshot;

      return;
    }

    if (isReadOnly || currentSnapshot === lastSavedSnapshot.current) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const saved = await onSaveDraft(toDraftSaveInput(section));
        lastSavedSnapshot.current = JSON.stringify(toDraftSaveInput(saved));
        setSection(saved);
        setSaveState('saved');
      } catch (error) {
        console.error('Autosave failed:', error);
        setSaveState('idle');
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isReadOnly, onSaveDraft, section]);

  async function handleConfirmSubmit() {
    const validationMessages = collectValidationMessages(section);

    if (validationMessages.length > 0) {
      setErrors(validationMessages);
      setShowSubmitDialog(false);

      return;
    }

    try {
      const submitted = await onSubmit(toSubmitInput(section));
      setSection(submitted);
      setErrors([]);
      setShowSubmitDialog(false);
      toast.success('Section submitted', {
        description: 'Your report section has been locked.',
      });
    } catch (error) {
      console.error('Submit failed:', error);
      setShowSubmitDialog(false);
      toast.error('Failed to submit section. Please try again.');
    }
  }

  return (
    <div className="space-y-8" aria-disabled={isReadOnly || undefined}>
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Report</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{section.authorName}</span>
            <Badge variant={section.status === 'submitted' ? 'default' : 'outline'}>
              {section.status === 'submitted' ? 'Submitted' : 'Draft'}
            </Badge>
            <AutosaveIndicator state={saveState} />
          </div>
        </div>
        {isReadOnly ? (
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            Section submitted and locked
          </Badge>
        ) : (
          <Button onClick={() => setShowSubmitDialog(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Submit Section
          </Button>
        )}
      </div>

      {/* Validation errors */}
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Please fix these issues</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Section 1: Project Statuses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Project Statuses</CardTitle>
              <CardDescription>Set traffic light for each project</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectStatusGrid
            projects={section.projects}
            disabled={isReadOnly}
            onChange={(projectId, value) => {
              setSection((currentSection) =>
                replaceSectionProjectLight(currentSection, projectId, value),
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Section 2: Weekly Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.68_0.17_152)]/10">
              <ListOrdered className="h-5 w-5 text-[oklch(0.68_0.17_152)]" />
            </div>
            <div>
              <CardTitle>Weekly Items</CardTitle>
              <CardDescription>Current and next week deliverables</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ItemsEditor
            items={section.items}
            disabled={isReadOnly}
            onCompletedChange={(itemIndex, completed) => {
              setSection((currentSection) => ({
                ...currentSection,
                items: currentSection.items.map((item, index) =>
                  index === itemIndex ? { ...item, completed } : item,
                ),
              }));
            }}
            onTextChange={(itemIndex, value) => {
              setSection((currentSection) => ({
                ...currentSection,
                items: currentSection.items.map((item, index) =>
                  index === itemIndex ? { ...item, text: value } : item,
                ),
              }));
            }}
          />
        </CardContent>
      </Card>

      {/* Section 3: Risks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Risks</CardTitle>
              <CardDescription>Active risks with impact assessment</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RisksEditor risks={section.risks} disabled={isReadOnly} />
        </CardContent>
      </Card>

      {/* Section 4: Decisions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
              <Lightbulb className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle>Decisions Required</CardTitle>
              <CardDescription>Items requiring management decision</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DecisionsEditor decisions={section.decisions} disabled={isReadOnly} />
        </CardContent>
      </Card>

      {/* Section 5: Priorities */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.62_0.18_310)]/10">
              <TrendingUp className="h-5 w-5 text-[oklch(0.62_0.18_310)]" />
            </div>
            <div>
              <CardTitle>Top 3 Priorities</CardTitle>
              <CardDescription>Key focus areas for next week</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PrioritiesEditor
            priorities={section.priorities}
            disabled={isReadOnly}
            onChange={(rank, value) => {
              setSection((currentSection) => ({
                ...currentSection,
                priorities: currentSection.priorities.map((priority) =>
                  priority.rank === rank ? { ...priority, text: value } : priority,
                ),
              }));
            }}
          />
        </CardContent>
      </Card>

      {/* Submit confirmation dialog */}
      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        title="Submit Section"
        description="Your report section will be locked for editing after submission. Continue?"
        confirmLabel="Submit Section"
        variant="default"
        onConfirm={handleConfirmSubmit}
      />
    </div>
  );
}
