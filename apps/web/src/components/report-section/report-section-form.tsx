'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  ListOrdered,
  Loader2,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ConfirmDialog,
  cn,
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
    // Filter out items/risks/decisions with empty required text (not yet filled by user)
    items: section.items.filter((item) => item.text.trim().length > 0),
    risks: section.risks.filter((risk) => risk.risk.trim().length > 0),
    decisions: section.decisions.filter((decision) => decision.text.trim().length > 0),
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

  if (section.priorities.length === 0) {
    errors.push('At least one priority must be added before submit.');
  } else if (section.priorities.some((priority) => priority.text.trim().length === 0)) {
    errors.push('All priorities must be filled before submit.');
  }

  return errors;
}

type SectionConfig = {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  countFn?: (section: ReportSectionReadModel) => number;
};

const sections: SectionConfig[] = [
  {
    id: 'statuses',
    icon: Target,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    title: 'Project Statuses',
    description: 'Set traffic light for each project',
    countFn: (s) => s.projects.filter((p) => p.trafficLight).length,
  },
  {
    id: 'items',
    icon: ListOrdered,
    iconColor: 'text-[oklch(0.68_0.17_152)]',
    iconBg: 'bg-[oklch(0.68_0.17_152)]/10',
    title: 'Weekly Items',
    description: 'Current and next week deliverables',
    countFn: (s) => s.items.filter((i) => i.text.trim().length > 0).length,
  },
  {
    id: 'risks',
    icon: AlertTriangle,
    iconColor: 'text-destructive',
    iconBg: 'bg-destructive/10',
    title: 'Risks',
    description: 'Active risks with impact assessment',
    countFn: (s) => s.risks.filter((r) => r.risk.trim().length > 0).length,
  },
  {
    id: 'decisions',
    icon: Lightbulb,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    title: 'Decisions Required',
    description: 'Items requiring management decision',
    countFn: (s) => s.decisions.filter((d) => d.text.trim().length > 0).length,
  },
  {
    id: 'priorities',
    icon: TrendingUp,
    iconColor: 'text-[oklch(0.62_0.18_310)]',
    iconBg: 'bg-[oklch(0.62_0.18_310)]/10',
    title: 'Top 3 Priorities',
    description: 'Key focus areas for next week',
    countFn: (s) => s.priorities.filter((p) => p.text.trim().length > 0).length,
  },
];

export function ReportSectionForm({
  initialSection,
  onSaveDraft,
  onSubmit,
}: ReportSectionFormProps) {
  const [section, setSection] = useState(initialSection);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    statuses: true,
    items: true,
    risks: true,
    decisions: true,
    priorities: true,
  });
  const isFirstRender = useRef(true);
  const lastSavedSnapshot = useRef(JSON.stringify(toDraftSaveInput(initialSection)));

  const isReadOnly = section.status === 'submitted';
  const defaultProjectId = section.projects[0]?.projectId ?? '';

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
        await onSaveDraft(toDraftSaveInput(section));
        lastSavedSnapshot.current = currentSnapshot;
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

    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderSectionContent(sectionId: string) {
    switch (sectionId) {
      case 'statuses':
        return (
          <ProjectStatusGrid
            projects={section.projects}
            disabled={isReadOnly}
            onChange={(projectId, value) => {
              setSection((currentSection) =>
                replaceSectionProjectLight(currentSection, projectId, value),
              );
            }}
          />
        );
      case 'items':
        return (
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
            onAdd={(type) => {
              setSection((currentSection) => ({
                ...currentSection,
                items: [
                  ...currentSection.items,
                  {
                    projectId: defaultProjectId,
                    type,
                    text: '',
                    tag: '',
                    workflowStatus: 'in_progress' as const,
                    carriedOver: false,
                    completed: null,
                  },
                ],
              }));
            }}
            onRemove={(itemIndex) => {
              setSection((currentSection) => ({
                ...currentSection,
                items: currentSection.items.filter((_, index) => index !== itemIndex),
              }));
            }}
          />
        );
      case 'risks':
        return (
          <RisksEditor
            risks={section.risks}
            disabled={isReadOnly}
            onAdd={() => {
              setSection((currentSection) => ({
                ...currentSection,
                risks: [
                  ...currentSection.risks,
                  { projectId: defaultProjectId, risk: '', impact: '', mitigation: '' },
                ],
              }));
            }}
            onRemove={(riskIndex) => {
              setSection((currentSection) => ({
                ...currentSection,
                risks: currentSection.risks.filter((_, index) => index !== riskIndex),
              }));
            }}
            onFieldChange={(riskIndex, field, value) => {
              setSection((currentSection) => ({
                ...currentSection,
                risks: currentSection.risks.map((risk, index) =>
                  index === riskIndex ? { ...risk, [field]: value } : risk,
                ),
              }));
            }}
          />
        );
      case 'decisions':
        return (
          <DecisionsEditor
            decisions={section.decisions}
            disabled={isReadOnly}
            onAdd={() => {
              setSection((currentSection) => ({
                ...currentSection,
                decisions: [
                  ...currentSection.decisions,
                  { text: '', owner: '', impact: '', deadline: null, resolvedAt: null },
                ],
              }));
            }}
            onRemove={(decisionIndex) => {
              setSection((currentSection) => ({
                ...currentSection,
                decisions: currentSection.decisions.filter((_, index) => index !== decisionIndex),
              }));
            }}
            onFieldChange={(decisionIndex, field, value) => {
              setSection((currentSection) => ({
                ...currentSection,
                decisions: currentSection.decisions.map((decision, index) =>
                  index === decisionIndex ? { ...decision, [field]: value } : decision,
                ),
              }));
            }}
          />
        );
      case 'priorities':
        return (
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
            onAdd={() => {
              setSection((currentSection) => {
                const nextRank = currentSection.priorities.length > 0
                  ? Math.max(...currentSection.priorities.map((p) => p.rank)) + 1
                  : 1;
                return {
                  ...currentSection,
                  priorities: [
                    ...currentSection.priorities,
                    { rank: nextRank, text: '' },
                  ],
                };
              });
            }}
            onRemove={(rank) => {
              setSection((currentSection) => ({
                ...currentSection,
                priorities: currentSection.priorities
                  .filter((p) => p.rank !== rank)
                  .map((p, i) => ({ ...p, rank: i + 1 })),
              }));
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">My Report</h1>
          <div className="flex items-center gap-2">
            <span className="text-base text-muted-foreground">{section.authorName}</span>
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
          <Button size="lg" onClick={() => setShowSubmitDialog(true)} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {isSubmitting ? 'Submitting...' : 'Submit Section'}
          </Button>
        )}
      </div>

      {/* Validation errors */}
      {errors.length > 0 ? (
        <Alert variant="destructive" role="alert">
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

      {/* Collapsible sections */}
      {sections.map((cfg) => {
        const Icon = cfg.icon;
        const count = cfg.countFn?.(section);
        const isOpen = openSections[cfg.id] ?? true;

        return (
          <Collapsible key={cfg.id} open={isOpen} onOpenChange={() => toggleSection(cfg.id)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none transition-colors hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', cfg.iconBg)}>
                      <Icon className={cn('h-5 w-5', cfg.iconColor)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{cfg.title}</CardTitle>
                        {count != null && count > 0 ? (
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        ) : null}
                      </div>
                      <CardDescription>{cfg.description}</CardDescription>
                    </div>
                    <ChevronDown className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      isOpen && 'rotate-180',
                    )} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {renderSectionContent(cfg.id)}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

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
