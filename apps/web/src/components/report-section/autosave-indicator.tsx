'use client';

import { Check, Loader2 } from 'lucide-react';

import { Badge } from '@customreport/ui';

type AutosaveIndicatorProps = {
  state: 'idle' | 'saving' | 'saved';
};

export function AutosaveIndicator({ state }: AutosaveIndicatorProps) {
  if (state === 'idle') {
    return null;
  }

  return (
    <div aria-live="polite">
      {state === 'saving' ? (
        <Badge variant="outline" className="gap-1.5">
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5">
          <Check className="size-3" />
          Saved
        </Badge>
      )}
    </div>
  );
}
