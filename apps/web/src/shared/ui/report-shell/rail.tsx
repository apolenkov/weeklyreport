export function Rail({ tone }: { readonly tone: string }) {
  return (
    <span
      className="min-h-[22px] self-stretch rounded-[2px]"
      style={{ background: tone }}
      aria-hidden="true"
    />
  );
}
