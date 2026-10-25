import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildFormerIdMap, remapFormerIds } = require("../scripts/fetch-ratings.js");

const players = [
  { id: "beeba", name: "Beeba", chessCom: "unlikelyeffect" },
  { id: "wealth", name: "Wealth", chessCom: "wealth98981" }
];

describe("buildFormerIdMap", () => {
  it("maps a former id to its current id", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    expect(map.get("unlikelyeffect")).toBe("beeba");
  });

  it("returns an empty map when formerIds is missing or malformed", () => {
    expect(buildFormerIdMap(players, undefined).size).toBe(0);
    expect(buildFormerIdMap(players, null).size).toBe(0);
    expect(buildFormerIdMap(players, []).size).toBe(0);
    expect(buildFormerIdMap(players, "nope").size).toBe(0);
  });

  it("ignores a former id that is still a live player id", () => {
    const map = buildFormerIdMap(players, { beeba: ["wealth"] });
    expect(map.size).toBe(0);
  });

  it("ignores a mapping whose current id is not a live player", () => {
    const map = buildFormerIdMap(players, { ghost: ["unlikelyeffect"] });
    expect(map.size).toBe(0);
  });

  it("ignores an id claimed by more than one player", () => {
    const map = buildFormerIdMap(
      [...players, { id: "other", name: "Other" }],
      { beeba: ["unlikelyeffect"], other: ["unlikelyeffect"] }
    );
    expect(map.size).toBe(1);
    expect(map.get("unlikelyeffect")).toBe("beeba");
  });

  it("treats a non-array value as a single former id", () => {
    const map = buildFormerIdMap(players, { beeba: "unlikelyeffect" });
    expect(map.get("unlikelyeffect")).toBe("beeba");
  });
});

describe("remapFormerIds", () => {
  it("rewrites matching snapshot ids and leaves others untouched", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    const snapshots = [
      { playerId: "unlikelyeffect", date: "2026-10-22" },
      { playerId: "wealth", date: "2026-10-22" }
    ];

    const result = remapFormerIds(snapshots, map) as Array<{ playerId: string }>;
    expect(result.map(s => s.playerId)).toEqual(["beeba", "wealth"]);
  });

  it("does not mutate the input snapshots", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    const snapshots = [{ playerId: "unlikelyeffect", date: "2026-10-22" }];

    remapFormerIds(snapshots, map);
    expect(snapshots[0].playerId).toBe("unlikelyeffect");
  });

  it("returns the input unchanged for an empty map", () => {
    const snapshots = [{ playerId: "wealth" }];
    expect(remapFormerIds(snapshots, new Map())).toBe(snapshots);
  });

  it("tolerates malformed snapshot entries", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    const snapshots = [null, { date: "2026-10-22" }];
    expect(remapFormerIds(snapshots, map)).toEqual(snapshots);
  });
});
