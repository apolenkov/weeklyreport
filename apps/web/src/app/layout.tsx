import type { ReactNode } from 'react';

import { Inter } from 'next/font/google';

import { Toaster, TooltipProvider } from '@customreport/ui';
import '@customreport/ui/styles/globals.css';

import { TRPCProvider } from '../components/providers/trpc-provider';

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-inter',
});

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-svh bg-background font-sans antialiased">
        <TooltipProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </TooltipProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
