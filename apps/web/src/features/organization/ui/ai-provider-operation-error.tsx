export function AiProviderOperationError({
  message,
  visible,
}: Readonly<{ message: string | null; visible: boolean }>) {
  if (!visible) return null;
  return (
    <p className="mt-3 text-xs text-red-600" role="alert">
      {message ?? "AI provider operation failed."}
    </p>
  );
}
