/**
 * Distribution helpers for the composite field chart.
 *
 * The field view summarises the club with a middle-50% band and a median line
 * instead of asking the eye to separate dozens of overlapping lines. Every
 * player still contributes to the distribution, and the individual traces stay
 * in the chart as context.
 */

export type DistributionPoint = {
  date: string;
  value: number;
};

export type DistributionBandPoint = {
  date: string;
  min: number;
  median: number;
  max: number;
};

export type DistributionSeries = {
  points: readonly DistributionPoint[];
};

/**
 * Linear-interpolated percentile over an ascending array. Matches the common
 * "inclusive" definition used by spreadsheet PERCENTILE, so a value on the
 * chart agrees with a number a maintainer could reproduce by hand.
 */
export function chartPercentile(
  sorted: readonly number[],
  fraction: number,
): number {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * The p25, median, and p75 of every date that has at least one value.
 *
 * Quantiles are computed independently per date so a missing snapshot for one
 * player cannot shift the band on days where their line is absent.
 */
export function chartDistributionBand(
  series: readonly DistributionSeries[],
): DistributionBandPoint[] {
  const valuesByDate = new Map<string, number[]>();

  for (const entry of series) {
    for (const point of entry.points) {
      if (!Number.isFinite(point.value)) continue;
      const values = valuesByDate.get(point.date) ?? [];
      values.push(point.value);
      valuesByDate.set(point.date, values);
    }
  }

  return [...valuesByDate.entries()]
    .map(([date, values]) => {
      values.sort((a, b) => a - b);
      return {
        date,
        min: chartPercentile(values, 0.25),
        median: chartPercentile(values, 0.5),
        max: chartPercentile(values, 0.75),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
