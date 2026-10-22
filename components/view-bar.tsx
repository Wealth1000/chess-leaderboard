"use client";

import {
  PLATFORMS,
  categoryLabel,
  platformLabel,
  rangeLabel,
} from "@/lib/format";
import { MAIN_CATEGORIES, RANGES } from "@/lib/ratings-view";
import type { MainCategory, Platform, RangeKey, ViewState } from "@/lib/types";
import styles from "./view-bar.module.css";

type ViewBarProps = {
  view: ViewState;
  focusName: string | null;
  onPlatformChange: (platform: Platform) => void;
  onCategoryChange: (category: MainCategory) => void;
  onRangeChange: (range: RangeKey) => void;
  onClearFocus: () => void;
};

export default function ViewBar({
  view,
  focusName,
  onPlatformChange,
  onCategoryChange,
  onRangeChange,
  onClearFocus,
}: ViewBarProps) {
  return (
    <nav className={styles.bar} aria-label="Leaderboard view">
      <div className={styles.groups}>
        <div className={styles.group} role="group" aria-label="Platform">
          <span className={styles.label} aria-hidden="true">
            Platform
          </span>
          <div className={styles.options}>
            {PLATFORMS.map((platform) => (
              <button
                type="button"
                className={styles.option}
                key={platform}
                aria-pressed={view.platform === platform}
                onClick={() => onPlatformChange(platform)}
              >
                {platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group} role="group" aria-label="Category">
          <span className={styles.label} aria-hidden="true">
            Category
          </span>
          <div className={styles.options}>
            {MAIN_CATEGORIES.map((category) => (
              <button
                type="button"
                className={styles.option}
                key={category}
                aria-pressed={view.category === category}
                onClick={() => onCategoryChange(category)}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group} role="group" aria-label="Range">
          <span className={styles.label} aria-hidden="true">
            Range
          </span>
          <div className={styles.options}>
            {RANGES.map((range) => (
              <button
                type="button"
                className={styles.option}
                key={range}
                aria-pressed={view.range === range}
                onClick={() => onRangeChange(range)}
              >
                {rangeLabel(range)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {focusName ? (
        <div className={styles.focus}>
          <span className={styles.focusLabel}>Focused player</span>
          <strong className={styles.focusName}>{focusName}</strong>
          <button
            type="button"
            className={styles.clear}
            onClick={onClearFocus}
          >
            Clear focus
          </button>
        </div>
      ) : null}
    </nav>
  );
}
