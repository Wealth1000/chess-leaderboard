/**
 * The field chart's y-axis ceiling.
 *
 * A single 2300-rated member stretches a full-field axis far enough that the
 * dense 700-1500 band collapses into the bottom third of the plot. The default
 * ceiling is the 90th percentile of the plotted values, rounded up to the next
 * 50, so the middle of the field owns most of the height.
 *
 * Clamping is deliberately not filtering: every line stays in the dataset and
 * outliers are clipped by the axis. The caption reports how many members sit
 * above the ceiling, so a clipped axis can never read as a missing player.
 *
 * Returns null when the axis should not be clamped: the caller asked for the
 * full range, there are too few players for a percentile to mean anything, or
 * the percentile already covers the top of the field.
 */

/** Below this many players a percentile is noise, and there is no tail to tame. */
export const CHART_CLAMP_MIN_PLAYERS = 8;

const ROUND_TO = 50;

const PERCENTILE = 0.9;

export function chartAxisCeiling(
  ratings: readonly number[],
  fullRange: boolean,
): number | null {
  const values = ratings
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (fullRange || values.length < CHART_CLAMP_MIN_PLAYERS) return null;

  const max = values[values.length - 1];
  const ceiling = Math.ceil(percentile(values, PERCENTILE) / ROUND_TO) * ROUND_TO;

  return ceiling >= max ? null : ceiling;
}

/** How many plotted members sit above the clamped ceiling. */
export function chartOutliersAbove(
  ratings: readonly number[],
  ceiling: number,
): number {
  return ratings.filter((value) => Number.isFinite(value) && value > ceiling)
    .length;
}

/**
 * Linear-interpolated percentile over an ascending array. Matches the common
 * "inclusive" definition used by spreadsheet PERCENTILE, so the clamp agrees
 * with a number a maintainer could reproduce by hand.
 */
function percentile(sorted: readonly number[], fraction: number): number {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
