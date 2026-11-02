import { describe, expect, it } from "vitest";
import {
  chartAxisCeiling,
  chartOutliersAbove,
  CHART_CLAMP_MIN_PLAYERS,
} from "@/lib/chart-scale";

const FIELD = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 2300];

describe("chartAxisCeiling", () => {
  it("clamps when a long tail would flatten the middle of the field", () => {
    // p90 of these eight values is 1810 (linear interpolation), rounded up to
    // 1850. The 2300 outlier sits above the ceiling.
    expect(chartAxisCeiling(FIELD, false)).toBe(1850);
  });

  it("never filters: calling it does not change the input array", () => {
    const input = [...FIELD];
    chartAxisCeiling(input, false);
    expect(input).toEqual(FIELD);
  });

  it("does not clamp when the full range is requested", () => {
    expect(chartAxisCeiling(FIELD, true)).toBeNull();
  });

  it("does not clamp a field too small for a percentile to mean anything", () => {
    const small = FIELD.slice(0, CHART_CLAMP_MIN_PLAYERS - 1);
    expect(small).toHaveLength(7);
    expect(chartAxisCeiling(small, false)).toBeNull();
  });

  it("clamps as soon as the minimum field size is reached", () => {
    expect(chartAxisCeiling(FIELD.slice(0, CHART_CLAMP_MIN_PLAYERS), false)).toBe(
      1850,
    );
  });

  it("does not clamp when the percentile already covers the top", () => {
    const flat = [800, 850, 900, 950, 1000, 1050, 1100, 1150];
    expect(chartAxisCeiling(flat, false)).toBeNull();
  });

  it("rounds the ceiling up and keeps an exact multiple of 50", () => {
    // p90 is exactly 1850 here; rounding must not pull it down to 1800.
    const values = [1000, 1100, 1200, 1300, 1400, 1500, 1700, 2200];
    expect(chartAxisCeiling(values, false)).toBe(1850);
  });

  it("ignores values that are not finite numbers", () => {
    const dirty = [...FIELD, Number.NaN, Number.POSITIVE_INFINITY];
    expect(chartAxisCeiling(dirty, false)).toBe(1850);
  });

  it("returns null for an empty field", () => {
    expect(chartAxisCeiling([], false)).toBeNull();
  });
});

describe("chartOutliersAbove", () => {
  it("counts the members the clamped axis cuts off", () => {
    expect(chartOutliersAbove(FIELD, 1850)).toBe(1);
  });

  it("counts nothing when the ceiling covers everyone", () => {
    expect(chartOutliersAbove(FIELD, 2300)).toBe(0);
  });

  it("ignores non-finite values", () => {
    expect(
      chartOutliersAbove([...FIELD, Number.NaN, Number.POSITIVE_INFINITY], 1850),
    ).toBe(1);
  });
});
