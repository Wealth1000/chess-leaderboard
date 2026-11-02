import { describe, expect, it } from "vitest";
import {
  chartDistributionBand,
  chartPercentile,
} from "@/lib/chart-distribution";

describe("chartPercentile", () => {
  it("interpolates between adjacent values", () => {
    expect(chartPercentile([1000, 1100, 1200, 1300], 0.25)).toBe(1075);
    expect(chartPercentile([1000, 1100, 1200, 1300], 0.5)).toBe(1150);
    expect(chartPercentile([1000, 1100, 1200, 1300], 0.75)).toBe(1225);
  });

  it("returns the only value for a single-element array", () => {
    expect(chartPercentile([1200], 0.25)).toBe(1200);
    expect(chartPercentile([1200], 0.9)).toBe(1200);
  });
});

describe("chartDistributionBand", () => {
  const series = [
    {
      points: [
        { date: "2026-10-02", value: 1000 },
        { date: "2026-10-01", value: 800 },
      ],
    },
    { points: [{ date: "2026-10-02", value: 1200 }] },
    { points: [{ date: "2026-10-02", value: 1400 }] },
    { points: [{ date: "2026-10-02", value: 1600 }] },
  ];

  it("computes p25, median, and p75 for each date", () => {
    expect(chartDistributionBand(series)).toEqual([
      { date: "2026-10-01", min: 800, median: 800, max: 800 },
      { date: "2026-10-02", min: 1150, median: 1300, max: 1450 },
    ]);
  });

  it("sorts dates and keeps single-player dates as a point band", () => {
    const result = chartDistributionBand(series);

    expect(result.map((point) => point.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(result[0]).toEqual({
      date: "2026-10-01",
      min: 800,
      median: 800,
      max: 800,
    });
  });

  it("does not mutate the input series", () => {
    const input = [
      {
        points: [
          { date: "2026-10-01", value: 1200 },
          { date: "2026-10-01", value: 1000 },
        ],
      },
    ];
    const points = input[0].points.map((point) => ({ ...point }));

    chartDistributionBand(input);

    expect(input[0].points).toEqual(points);
  });

  it("returns an empty band when no series has points", () => {
    expect(chartDistributionBand([])).toEqual([]);
    expect(chartDistributionBand([{ points: [] }])).toEqual([]);
  });

  it("ignores non-finite values", () => {
    expect(
      chartDistributionBand([
        {
          points: [
            { date: "2026-10-01", value: Number.NaN },
            { date: "2026-10-01", value: 1200 },
            { date: "2026-10-01", value: Number.POSITIVE_INFINITY },
          ],
        },
      ]),
    ).toEqual([{ date: "2026-10-01", min: 1200, median: 1200, max: 1200 }]);
  });
});
