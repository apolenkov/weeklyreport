import { cn } from "@customreport/ui/lib/utils";

/**
 * Placeholder shimmer block for loading states.
 * @param props - The props argument.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
