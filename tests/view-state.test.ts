import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW_STATE } from "@/lib/ratings-view";
import { resolveViewState } from "@/lib/view-state";

describe("resolveViewState", () => {
  it("resolves non-object and null payloads to the documented defaults", () => {
    expect(resolveViewState(null)).toEqual(DEFAULT_VIEW_STATE);
    expect(resolveViewState(undefined)).toEqual(DEFAULT_VIEW_STATE);
    expect(resolveViewState("nope")).toEqual(DEFAULT_VIEW_STATE);
    expect(resolveViewState(42)).toEqual(DEFAULT_VIEW_STATE);
    expect(resolveViewState(true)).toEqual(DEFAULT_VIEW_STATE);
    expect(resolveViewState([])).toEqual(DEFAULT_VIEW_STATE);
  });

  it("preserves a valid legacy payload and resolves layout to board", () => {
    const legacy = {
      platform: "lichess",
      category: "blitz",
      range: "30d",
      focusPlayerId: "member",
    };

    expect(resolveViewState(legacy)).toEqual({
      platform: "lichess",
      category: "blitz",
      range: "30d",
      focusPlayerId: "member",
      layout: "board",
      showHidden: false,
      fullChartRange: false,
    });
  });

  it("preserves a stored list layout", () => {
    const stored = {
      ...DEFAULT_VIEW_STATE,
      layout: "list",
    };

    expect(resolveViewState(stored).layout).toBe("list");
  });

  it("resolves an unknown layout value to board", () => {
    expect(resolveViewState({ layout: "grid" }).layout).toBe("board");
    expect(resolveViewState({ layout: "" }).layout).toBe("board");
    expect(resolveViewState({ layout: null }).layout).toBe("board");
    expect(resolveViewState({ layout: 7 }).layout).toBe("board");
  });

  it("falls back on each invalid field without discarding its valid siblings", () => {
    const resolved = resolveViewState({
      platform: "nope",
      category: "blitz",
      range: "forever",
      focusPlayerId: 42,
      layout: "list",
    });

    expect(resolved).toEqual({
      platform: DEFAULT_VIEW_STATE.platform,
      category: "blitz",
      range: DEFAULT_VIEW_STATE.range,
      focusPlayerId: null,
      layout: "list",
      showHidden: false,
      fullChartRange: false,
    });
  });

  it("decodes the boolean view toggles and rejects non-booleans", () => {
    expect(
      resolveViewState({ showHidden: true, fullChartRange: true }),
    ).toMatchObject({ showHidden: true, fullChartRange: true });

    expect(
      resolveViewState({ showHidden: false, fullChartRange: false }),
    ).toMatchObject({ showHidden: false, fullChartRange: false });

    for (const bad of ["true", 1, 0, null, {}, []]) {
      expect(
        resolveViewState({ showHidden: bad, fullChartRange: bad }),
      ).toMatchObject({ showHidden: false, fullChartRange: false });
    }
  });

  it("decodes each boolean independently of the other", () => {
    expect(resolveViewState({ showHidden: true })).toMatchObject({
      showHidden: true,
      fullChartRange: false,
    });
    expect(resolveViewState({ fullChartRange: true })).toMatchObject({
      showHidden: false,
      fullChartRange: true,
    });
  });

  it("treats an empty or non-string focus player id as no focus", () => {
    expect(resolveViewState({ focusPlayerId: "" }).focusPlayerId).toBeNull();
    expect(resolveViewState({ focusPlayerId: "x" }).focusPlayerId).toBe("x");
  });

  it("treats a bullet category as invalid for the main category", () => {
    // Bullet is a valid rating category but not a main-category view value.
    expect(resolveViewState({ category: "bullet" }).category).toBe(
      DEFAULT_VIEW_STATE.category,
    );
  });
});
