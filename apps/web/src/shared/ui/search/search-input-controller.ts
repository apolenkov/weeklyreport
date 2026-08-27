import type { SearchHit } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useDismissOnOutsidePointer } from "../../hooks/browser/use-dismiss-on-outside-pointer";
import { isViewer as isViewerRole } from "../../lib/auth/role-predicates";
import { useSession } from "../../lib/auth/session-provider";
import { useTRPC } from "../../lib/trpc/trpc-context";
import {
  DEBOUNCE_MS,
  MAX_LEN,
  MIN_LEN,
  type SearchScope,
  targetUrlFor,
  useDebouncedValue,
} from "./search-input-utils";

interface ActiveSelection {
  readonly hits: readonly SearchHit[];
  readonly index: number;
}

export interface SearchController {
  readonly q: string;
  readonly setQ: (value: string) => void;
  readonly open: boolean;
  readonly setOpen: (value: boolean) => void;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly enabled: boolean;
  readonly hits: readonly SearchHit[];
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isViewer: boolean;
  readonly activeIndex: number;
  readonly setActiveIndex: (idx: number) => void;
  readonly handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  readonly navigateTo: (url: string) => void;
}

const RESULT_LIMIT = 20;
const RESULT_STALE_MS = 30_000;

function useSearchHits(q: string, scope: SearchScope, isViewer: boolean) {
  const trpc = useTRPC();
  const debouncedQ = useDebouncedValue(q.trim(), DEBOUNCE_MS);
  const enabled = debouncedQ.length >= MIN_LEN && debouncedQ.length <= MAX_LEN;

  const { data, isError, isFetching } = useQuery({
    ...trpc.search.query.queryOptions({
      q: debouncedQ,
      scope,
      limit: RESULT_LIMIT,
    }),
    enabled,
    staleTime: RESULT_STALE_MS,
  });

  const hits = useMemo<readonly SearchHit[]>(() => {
    const all = data ?? [];
    // Defensive: the server already excludes project hits for a viewer; drop
    // any that slip through so a viewer never sees a product dead-end row.
    return isViewer ? all.filter((hit) => hit.type !== "project") : all;
  }, [data, isViewer]);

  return { enabled, hits, isError, isFetching };
}

interface KeyDownArgs {
  readonly hits: readonly SearchHit[];
  readonly open: boolean;
  readonly activeIndex: number;
  readonly isViewer: boolean;
  readonly clear: () => void;
  readonly moveActive: (delta: number) => void;
  readonly navigateTo: (url: string) => void;
}

function activeTargetUrl(args: KeyDownArgs): string | null {
  const hit = args.hits.at(args.activeIndex);
  if (!hit) return null;
  const target = targetUrlFor(hit, args.isViewer);
  return target.kind === "navigable" ? target.url : null;
}

// Escape always clears; arrows and Enter only act on an open, non-empty list.
function keyDownHandler(args: KeyDownArgs) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      args.clear();
      return;
    }
    if (!args.open || args.hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      args.moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      args.moveActive(-1);
    } else if (e.key === "Enter") {
      const targetUrl = activeTargetUrl(args);
      if (targetUrl) {
        e.preventDefault();
        args.navigateTo(targetUrl);
      }
    }
  };
}

interface ActiveSelectionControls {
  readonly activeIndex: number;
  readonly setActiveIndex: (idx: number) => void;
  readonly moveActive: (delta: number) => void;
}

// Selection is stored PAIRED with the hit list it was made in; a new result
// set naturally resets it to 0 without a reset effect.
function useActiveSelection(
  hits: readonly SearchHit[],
): ActiveSelectionControls {
  const [active, setActive] = useState<ActiveSelection | null>(null);

  return {
    activeIndex: active?.hits === hits ? active.index : 0,
    setActiveIndex: (idx: number) => setActive({ hits, index: idx }),
    moveActive: (delta: number) => {
      setActive((prev) => {
        const current = prev?.hits === hits ? prev.index : 0;
        const upper = Math.max(hits.length - 1, 0);
        return { hits, index: Math.min(Math.max(current + delta, 0), upper) };
      });
    },
  };
}

export function useSearchController(scope: SearchScope): SearchController {
  const router = useRouter();
  const { user } = useSession();
  const isViewer = isViewerRole(user?.role ?? null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { enabled, hits, isError, isFetching } = useSearchHits(
    q,
    scope,
    isViewer,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  useDismissOnOutsidePointer({
    open,
    refs: [containerRef],
    onDismiss: () => setOpen(false),
  });
  const { activeIndex, setActiveIndex, moveActive } = useActiveSelection(hits);

  const navigateTo = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  return {
    q,
    setQ,
    open,
    setOpen,
    containerRef,
    enabled,
    hits,
    isError,
    isFetching,
    isViewer,
    activeIndex,
    setActiveIndex,
    handleKeyDown: keyDownHandler({
      hits,
      open,
      activeIndex,
      isViewer,
      clear: () => {
        setQ("");
        setOpen(false);
      },
      moveActive,
      navigateTo,
    }),
    navigateTo,
  };
}
