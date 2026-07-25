import type { SearchHit } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { isViewer as isViewerRole } from "../../lib/role-predicates";
import { useSession } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
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

export function useSearchController(scope: SearchScope): SearchController {
  const router = useRouter();
  const trpc = useTRPC();
  const { user } = useSession();
  const isViewer = isViewerRole(user?.role ?? null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Selection is stored PAIRED with the hit list it was made in; a new result
  // set naturally resets it to 0 without a reset effect.
  const [active, setActive] = useState<ActiveSelection | null>(null);
  const debouncedQ = useDebouncedValue(q.trim(), DEBOUNCE_MS);

  const enabled = debouncedQ.length >= MIN_LEN && debouncedQ.length <= MAX_LEN;

  const { data, isError, isFetching } = useQuery({
    ...trpc.search.query.queryOptions({ q: debouncedQ, scope, limit: 20 }),
    enabled,
    staleTime: 30_000,
  });

  const hits = useMemo<readonly SearchHit[]>(() => {
    const all = data ?? [];
    // Defensive: the server already excludes project hits for a viewer; drop
    // any that slip through so a viewer never sees a product dead-end row.
    return isViewer ? all.filter((hit) => hit.type !== "project") : all;
  }, [data, isViewer]);

  const activeIndex = active?.hits === hits ? active.index : 0;
  const moveActive = (delta: number) => {
    setActive((prev) => {
      const current = prev?.hits === hits ? prev.index : 0;
      const upper = Math.max(hits.length - 1, 0);
      return {
        hits,
        index: Math.min(Math.max(current + delta, 0), upper),
      };
    });
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const navigateTo = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setQ("");
      setOpen(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      const hit = hits.at(activeIndex);
      if (hit) {
        e.preventDefault();
        navigateTo(targetUrlFor(hit, isViewer));
      }
    }
  }

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
    setActiveIndex: (idx: number) => setActive({ hits, index: idx }),
    handleKeyDown,
    navigateTo,
  };
}
