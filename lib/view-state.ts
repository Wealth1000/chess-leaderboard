import {
  DEFAULT_VIEW_STATE,
  MAIN_CATEGORIES,
  RANGES,
} from "@/lib/ratings-view";
import type { Layout, MainCategory, Platform, RangeKey, ViewState } from "@/lib/types";

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

function isLayout(value: unknown): value is Layout {
  return value === "board" || value === "list";
}

/**
 * Normalizes a stored payload into a complete `ViewState`.
 *
 * This is the hydration contract for the persisted view: the first render uses
 * the documented defaults, and any stored value is treated as untrusted. Each
 * field is validated independently, so one bad value falls back on its own
 * without discarding valid siblings. A legacy payload written before `layout`
 * existed is valid and resolves to the board; an unknown layout value resolves
 * to the board as the safe default. Malformed input never throws.
 */
export function resolveViewState(stored: unknown): ViewState {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_VIEW_STATE };

  const value = stored as Partial<Record<keyof ViewState, unknown>>;

  return {
    platform: isPlatform(value.platform)
      ? value.platform
      : DEFAULT_VIEW_STATE.platform,
    category: isMainCategory(value.category)
      ? value.category
      : DEFAULT_VIEW_STATE.category,
    range: isRange(value.range) ? value.range : DEFAULT_VIEW_STATE.range,
    focusPlayerId:
      typeof value.focusPlayerId === "string" && value.focusPlayerId.length > 0
        ? value.focusPlayerId
        : null,
    layout: isLayout(value.layout) ? value.layout : DEFAULT_VIEW_STATE.layout,
  };
}
