"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VIEW_STATE } from "@/lib/ratings-view";
import { resolveViewState } from "@/lib/view-state";
import type {
  Layout,
  MainCategory,
  Platform,
  RangeKey,
  ViewState,
} from "@/lib/types";

const STORAGE_KEY = "chess-leaderboard:view-state:v1";

export type ViewStateControls = {
  view: ViewState;
  setPlatform: (platform: Platform) => void;
  setCategory: (category: MainCategory) => void;
  setRange: (range: RangeKey) => void;
  setFocusPlayer: (playerId: string | null) => void;
  setLayout: (layout: Layout) => void;
};

/**
 * Persists the five view values under one localStorage key.
 *
 * The first render always uses the documented defaults so static export and
 * client hydration agree. Stored values are read in an effect, and writing is
 * disabled until that read completes, so a valid stored view is never
 * overwritten with defaults.
 */
export function useViewState(): ViewStateControls {
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW_STATE });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setView(resolveViewState(JSON.parse(raw)));
      }
    } catch {
      // A blocked or malformed store simply leaves the defaults in place.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
      // Private browsing and storage quotas should not break the page.
    }
  }, [hydrated, view]);

  const setPlatform = useCallback((platform: Platform) => {
    setView((current) => ({ ...current, platform }));
  }, []);

  const setCategory = useCallback((category: MainCategory) => {
    setView((current) => ({ ...current, category }));
  }, []);

  const setRange = useCallback((range: RangeKey) => {
    setView((current) => ({ ...current, range }));
  }, []);

  const setFocusPlayer = useCallback((playerId: string | null) => {
    setView((current) => ({ ...current, focusPlayerId: playerId }));
  }, []);

  const setLayout = useCallback((layout: Layout) => {
    setView((current) => ({ ...current, layout }));
  }, []);

  return {
    view,
    setPlatform,
    setCategory,
    setRange,
    setFocusPlayer,
    setLayout,
  };
}
