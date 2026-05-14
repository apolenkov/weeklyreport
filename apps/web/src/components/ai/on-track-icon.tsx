"use client";

// Phase 31 (AI-03) — On-track advisory icon. Renders alongside (NEVER
// replaces) the lead's chosen traffic-light. Sized 16px to match small
// status indicators; hidden when AI is unavailable.
import { useQuery } from "@tanstack/react-query";
import { Check, AlertTriangle, X } from "lucide-react";
import { useTRPC } from "../../lib/trpc-context";

type Props = {
  readonly sectionId: string;
  readonly projectId: string;
};

export function OnTrackIcon({ sectionId, projectId }: Props) {
  const trpc = useTRPC();
  const q = useQuery(trpc.ai.onTrack.queryOptions({ sectionId, projectId }));

  if (q.isLoading) {
    return (
      <span
        aria-busy="true"
        className="ml-1 inline-block h-3 w-3 animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]"
      />
    );
  }
  const data = q.data;
  if (!data || !data.available) return null;

  const verdict = data.result.verdict;
  const tooltip = `${data.result.confidence} confidence — ${data.result.rationale}`;

  if (verdict === "on-track") {
    return (
      <Check
        size={16}
        className="ml-1 inline-block text-emerald-600"
        aria-label={`On-track (${tooltip})`}
      >
        <title>{tooltip}</title>
      </Check>
    );
  }
  if (verdict === "attention") {
    return (
      <AlertTriangle
        size={16}
        className="ml-1 inline-block text-amber-600"
        aria-label={`Attention (${tooltip})`}
      >
        <title>{tooltip}</title>
      </AlertTriangle>
    );
  }
  return (
    <X
      size={16}
      className="ml-1 inline-block text-red-600"
      aria-label={`Off-track (${tooltip})`}
    >
      <title>{tooltip}</title>
    </X>
  );
}
