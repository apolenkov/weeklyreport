import React from 'react';

void React;

type AutosaveIndicatorProps = {
  state: 'idle' | 'saving' | 'saved';
};

export function AutosaveIndicator({ state }: AutosaveIndicatorProps) {
  if (state === 'idle') {
    return null;
  }

  return (
    <p aria-live="polite">
      {state === 'saving' ? 'Сохраняется...' : 'Сохранено'}
    </p>
  );
}
