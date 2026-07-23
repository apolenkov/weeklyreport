import type { ComponentProps, ReactNode } from "react";

interface LeadFormAddButtonProps extends Pick<
  ComponentProps<"button">,
  "disabled" | "onClick" | "title"
> {
  readonly children: ReactNode;
}

export function LeadFormAddButton({
  children,
  disabled,
  onClick,
  title,
}: LeadFormAddButtonProps) {
  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[var(--touch-target-min)] min-w-[136px] items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
