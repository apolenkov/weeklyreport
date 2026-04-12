'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
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
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight ?? undefined,
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
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[1.2]">My Report</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{section.authorName}</span>
          <Badge variant={section.status === 'submitted' ? 'default' : 'outline'}>
            {section.status === 'submitted' ? 'Submitted' : 'Draft'}
          </Badge>
          <AutosaveIndicator state={saveState} />
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Invalid data</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Project Statuses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">Project Statuses</CardTitle>
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

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">Items</CardTitle>
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

      {/* Risks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">Risks</CardTitle>
        </CardHeader>
        <CardContent>
          <RisksEditor risks={section.risks} disabled={isReadOnly} />
        </CardContent>
      </Card>

      {/* Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">Decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <DecisionsEditor decisions={section.decisions} disabled={isReadOnly} />
        </CardContent>
      </Card>

      {/* Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[20px] font-semibold leading-[1.3]">Top 3 Priorities</CardTitle>
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

      {/* Submit button / submitted state */}
      {!isReadOnly ? (
        <Button onClick={() => setShowSubmitDialog(true)}>
          Submit Section
        </Button>
      ) : null}

      {isReadOnly ? (
        <Badge variant="outline" className="gap-1.5">
          <Check className="size-3" />
          Section submitted
        </Badge>
      ) : null}

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
