'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  type DraftSavePayload,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

import { AutosaveIndicator } from './autosave-indicator';
import { DecisionsEditor } from './decisions-editor';
import { ItemsEditor } from './items-editor';
import { PrioritiesEditor } from './priorities-editor';
import { ProjectStatusGrid } from './project-status-grid';
import { RisksEditor } from './risks-editor';

void React;

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
      status: project.trafficLight ?? 'red',
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
      const saved = await onSaveDraft(toDraftSaveInput(section));
      lastSavedSnapshot.current = JSON.stringify(toDraftSaveInput(saved));
      setSection(saved);
      setSaveState('saved');
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

    const submitted = await onSubmit(toSubmitInput(section));
    setSection(submitted);
    setErrors([]);
    setShowSubmitDialog(false);
  }

  return (
    <form>
      <h1>Мой отчёт</h1>
      <p>Author: {section.authorName}</p>
      <p>Status: {section.status}</p>
      <AutosaveIndicator state={saveState} />
      {errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <ProjectStatusGrid
        projects={section.projects}
        disabled={isReadOnly}
        onChange={(projectId, value) => {
          setSection((currentSection) =>
            replaceSectionProjectLight(currentSection, projectId, value),
          );
        }}
      />
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
      <RisksEditor risks={section.risks} disabled={isReadOnly} />
      <DecisionsEditor decisions={section.decisions} disabled={isReadOnly} />
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
      {!isReadOnly ? (
        <button type="button" onClick={() => setShowSubmitDialog(true)}>
          Submit section
        </button>
      ) : null}
      {isReadOnly ? <p>Секция отправлена</p> : null}
      {showSubmitDialog ? (
        <div aria-modal="true" role="dialog">
          <p>Вы уверены?</p>
          <button type="button" onClick={handleConfirmSubmit}>
            Confirm submit
          </button>
          <button type="button" onClick={() => setShowSubmitDialog(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </form>
  );
}
