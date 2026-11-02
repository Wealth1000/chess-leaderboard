import { describe, expect, it } from "vitest";
import { countHiddenRanked, selectVisibleRanked } from "@/lib/ratings-view";
import type { RankedPlayer } from "@/lib/types";

function ranked(
  id: string,
  handle: string | null,
  overrides: Partial<RankedPlayer> = {},
): RankedPlayer {
  return {
    id,
    name: id,
    rank: 1,
    rating: handle ? 1000 : null,
    handle,
    platforms: handle ? ["chess.com"] : [],
    aliasText: `${id} ${id}`,
    snapshot: null,
    change: {
      delta: null,
      direction: "unavailable",
      comparisonDate: null,
      latestDate: null,
    },
    ...overrides,
  };
}

// The Chess.com view of a mostly-Lichess group: two members without a
// Chess.com account, one of them also absent from the alias text.
const RANKED: RankedPlayer[] = [
  ranked("wealth", "wealth98981"),
  ranked("fifi_enko", null, { name: "Fifi_Enko" }),
  ranked("ghost", null),
];

describe("selectVisibleRanked", () => {
  it("hides members with no account on the active platform by default", () => {
    const visible = selectVisibleRanked(RANKED, { query: "", showHidden: false });
    expect(visible.map((player) => player.id)).toEqual(["wealth"]);
  });

  it("keeps every member when hidden players are revealed", () => {
    const visible = selectVisibleRanked(RANKED, { query: "", showHidden: true });
    expect(visible.map((player) => player.id)).toEqual([
      "wealth",
      "fifi_enko",
      "ghost",
    ]);
  });

  it("keeps the ranked order exactly as handed in", () => {
    const reversed = [...RANKED].reverse();
    expect(
      selectVisibleRanked(reversed, { query: "", showHidden: true }).map(
        (player) => player.id,
      ),
    ).toEqual(reversed.map((player) => player.id));
  });

  it("reveals a hidden member when the search names them", () => {
    const visible = selectVisibleRanked(RANKED, {
      query: "fifi",
      showHidden: false,
    });
    expect(visible.map((player) => player.id)).toEqual(["fifi_enko"]);
  });

  it("searches case-insensitively and ignores surrounding space", () => {
    const visible = selectVisibleRanked(RANKED, {
      query: "  FIFI  ",
      showHidden: false,
    });
    expect(visible.map((player) => player.id)).toEqual(["fifi_enko"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(
      selectVisibleRanked(RANKED, { query: "nobody", showHidden: true }),
    ).toEqual([]);
  });

  it("does not mutate the ranked array", () => {
    const input = [...RANKED];
    selectVisibleRanked(input, { query: "", showHidden: false });
    expect(input).toEqual(RANKED);
  });
});

describe("countHiddenRanked", () => {
  it("counts the members the default view leaves out", () => {
    expect(countHiddenRanked(RANKED)).toBe(2);
  });

  it("returns zero when every member has an account", () => {
    expect(countHiddenRanked([RANKED[0]])).toBe(0);
  });
});
