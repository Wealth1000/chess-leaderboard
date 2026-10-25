"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_VIEW_STATE,
  MAIN_CATEGORIES,
  RANGES,
} from "@/lib/ratings-view";
import type { MainCategory, Platform, RangeKey, ViewState } from "@/lib/types";

const STORAGE_KEY = "chess-leaderboard:view-state:v1";

export type ViewStateControls = {
  view: ViewState;
  setPlatform: (platform: Platform) => void;
  setCategory: (category: MainCategory) => void;
  setRange: (range: RangeKey) => void;
  setFocusPlayer: (playerId: string | null) => void;
};

function isPlatform(value: unknown): value is Platform {
  return value === "chess.com" || value === "lichess";
}

function isMainCategory(value: unknown): value is MainCategory {
  return (
    typeof value === "string" &&
    (MAIN_CATEGORIES as string[]).includes(value)
  );
}

function isRange(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGES as string[]).includes(value);
}

function validateViewState(value: unknown): ViewState {
  if (!value || typeof value !== "object") return { ...DEFAULT_VIEW_STATE };

  const stored = value as Partial<Record<keyof ViewState, unknown>>;

  return {
    platform: isPlatform(stored.platform)
      ? stored.platform
      : DEFAULT_VIEW_STATE.platform,
    category: isMainCategory(stored.category)
      ? stored.category
      : DEFAULT_VIEW_STATE.category,
    range: isRange(stored.range) ? stored.range : DEFAULT_VIEW_STATE.range,
    focusPlayerId:
      typeof stored.focusPlayerId === "string" && stored.focusPlayerId.length > 0
        ? stored.focusPlayerId
        : null,
  };
}

/**
 * Persists the four view values under one localStorage key.
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
        setView(validateViewState(JSON.parse(raw)));
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

  return { view, setPlatform, setCategory, setRange, setFocusPlayer };
}
