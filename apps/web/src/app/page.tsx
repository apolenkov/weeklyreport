import { Button } from '@customreport/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-[28px] font-semibold leading-[1.2]">
          CustomReport
        </h1>
        <p className="text-sm text-muted-foreground">
          Weekly status reporting system
        </p>
        <Button>Get Started</Button>
      </div>
    </main>
  );
}
