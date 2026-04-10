import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TRPCProvider } from '../components/providers/trpc-provider';

function AllProviders({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { render, screen, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
