import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  parseChessComStats,
  parseLichessStats,
  buildV2Account,
  buildV2Snapshot,
  encodeDocument,
  mergeSnapshots,
  remapFormerIds,
  buildFormerIdMap,
  isV2Entry,
  isV2Document,
  readExistingDocument
} = require("../scripts/fetch-ratings.js");

// A Chess.com stats payload shaped like the real API response. The classical
// source is `chess_daily`, and its record carries the extra `time_per_move` /
// `timeout_percent` keys that must be ignored by the game count.
const chessComStats = {
  chess_rapid: {
    last: { rating: 2114 },
    record: { win: 3000, loss: 700, draw: 12, time_per_move: 999, timeout_percent: 4.2 }
  },
  chess_daily: {
    last: { rating: 529 },
    record: { win: 100, loss: 30, draw: 7, time_per_move: 500, timeout_percent: 1.5 }
  },
  chess_blitz: {
    last: { rating: 1851 },
    record: { win: 2000, loss: 900, draw: 88, time_per_move: 111 }
  },
  chess_bullet: {
    last: { rating: 1081 },
    record: { win: 1000, loss: 60, draw: 7 }
  },
  tactics: { highest: { rating: 1554 } },
  puzzle_rush: { best: { score: 42 } }
};

const lichessStats = {
  perfs: {
    rapid: { rating: 2332, games: 3712 },
    classical: { rating: 2100, games: 137 },
    blitz: { rating: 2400, games: 2988 },
    bullet: { rating: 2500, games: 1067 },
    puzzle: { rating: 2800, games: 50000 }
  }
};

describe("game-count sourcing", () => {
  it("sums Chess.com win + loss + draw per category", () => {
    const { gamesPlayed } = parseChessComStats(chessComStats);
    expect(gamesPlayed.rapid).toBe(3000 + 700 + 12);
    expect(gamesPlayed.classical).toBe(100 + 30 + 7);
    expect(gamesPlayed.blitz).toBe(2000 + 900 + 88);
    expect(gamesPlayed.bullet).toBe(1000 + 60 + 7);
  });

  it("ignores the non-numeric extras on a Chess.com record", () => {
    const { gamesPlayed } = parseChessComStats(chessComStats);
    // time_per_move / timeout_percent must not leak into the sum.
    expect(gamesPlayed.classical).toBe(137);
    expect(gamesPlayed.rapid).toBe(3712);
  });

  it("omits a category when its record is missing or has no numbers", () => {
    const { gamesPlayed } = parseChessComStats({
      chess_rapid: { last: { rating: 2114 } },
      chess_blitz: { last: { rating: 1851 }, record: { time_per_move: 5 } }
    });

    expect("rapid" in gamesPlayed).toBe(false);
    expect("blitz" in gamesPlayed).toBe(false);
  });

  it("never coerces a missing count to 0", () => {
    const { gamesPlayed } = parseChessComStats({
      chess_rapid: { last: { rating: 2114 } }
    });

    expect(gamesPlayed.rapid).toBeUndefined();
    expect(gamesPlayed.rapid).not.toBe(0);
  });

  it("reads Lichess counts from perfs.<category>.games and excludes puzzle", () => {
    const { gamesPlayed } = parseLichessStats(lichessStats);
    expect(gamesPlayed).toEqual({
      rapid: 3712,
      classical: 137,
      blitz: 2988,
      bullet: 1067
    });
    expect("puzzle" in gamesPlayed).toBe(false);
  });

  it("does not count a Lichess category whose rating is not real", () => {
    const { ratings, gamesPlayed } = parseLichessStats({
      perfs: { rapid: { rating: 1500, games: 0 } }
    });

    expect(ratings.rapid).toBeNull();
    expect("rapid" in gamesPlayed).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(() => parseChessComStats(null)).not.toThrow();
    expect(() => parseLichessStats(undefined)).not.toThrow();
  });
});

describe("buildV2Account", () => {
  const ratings = { rapid: 2114, classical: 529, blitz: 1851, bullet: 1081, puzzle: null };
  const gamesPlayed = { rapid: 3712, classical: 137, blitz: 2988, bullet: 1067 };

  it("puts numeric ratings in ratings and unavailable categories in unplayed", () => {
    const account = buildV2Account("mr_wiafe", ratings, gamesPlayed);

    expect(account.ratings).toEqual({
      rapid: 2114,
      classical: 529,
      blitz: 1851,
      bullet: 1081
    });
    expect(account.unplayed).toEqual(["puzzle"]);
  });

  it("keeps username and drops playerName", () => {
    const account = buildV2Account("mr_wiafe", ratings, gamesPlayed);

    expect(account.username).toBe("mr_wiafe");
    expect("playerName" in account).toBe(false);
    expect(JSON.stringify(account)).not.toContain("playerName");
  });

  it("omits gamesPlayed when empty", () => {
    const account = buildV2Account("someone", { rapid: 1500, puzzle: null }, {});
    expect("gamesPlayed" in account).toBe(false);
  });

  it("only attaches counts to rated categories", () => {
    const account = buildV2Account(
      "someone",
      { rapid: 1500, puzzle: null },
      { rapid: 10, puzzle: 999, blitz: 3 }
    );

    expect(account.gamesPlayed).toEqual({ rapid: 10 });
  });
});

describe("buildV2Snapshot / encodeDocument", () => {
  const accounts = {
    "chess.com": buildV2Account(
      "mr_wiafe",
      { rapid: 2114, classical: 529, blitz: 1851, bullet: 1081, puzzle: null },
      { rapid: 3712 }
    )
  };

  it("omits accounts when empty", () => {
    const snapshot = buildV2Snapshot("ghost", "2026-10-31", {}, null);
    expect("accounts" in snapshot).toBe(false);
  });

  it("omits chessComExtras when absent", () => {
    const snapshot = buildV2Snapshot("someone", "2026-10-31", accounts, null);
    expect("chessComExtras" in snapshot).toBe(false);
  });

  it("encodes a minified version 2 document", () => {
    const encoded = encodeDocument([buildV2Snapshot("wiafe", "2026-10-31", accounts, null)]);

    expect(encoded).not.toContain("\n");
    expect(encoded).not.toContain("  ");
    expect(encoded.startsWith('{"version":2,"snapshots":[')).toBe(true);

    const parsed = JSON.parse(encoded);
    expect(parsed.version).toBe(2);
    expect(parsed.snapshots[0].playerId).toBe("wiafe");
    expect(parsed.snapshots[0].accounts["chess.com"].username).toBe("mr_wiafe");
  });

  it("encodes a merged result object directly", () => {
    const encoded = encodeDocument({ snapshots: [buildV2Snapshot("wiafe", "2026-10-31", accounts, null)] });
    expect(JSON.parse(encoded).snapshots).toHaveLength(1);
  });
});

describe("format detection", () => {
  it("detects a v2 document by its version field", () => {
    expect(isV2Document({ version: 2, snapshots: [] })).toBe(true);
    expect(isV2Document({ snapshots: [] })).toBe(false);
  });

  it("detects a v2 entry by its accounts object, per entry", () => {
    expect(isV2Entry({ playerId: "a", accounts: { lichess: {} } })).toBe(true);
    expect(isV2Entry({ playerId: "a", ratings: [] })).toBe(false);
  });

  it("reads a v1 document without upgrading its entries", () => {
    const v1 = { snapshots: [{ playerId: "a", date: "2026-10-01", ratings: [{ category: "rapid", rating: 1500 }] }] };
    const read = readExistingDocument(v1);

    expect(read.version).toBeNull();
    expect(read.snapshots[0]).toBe(v1.snapshots[0]);
    expect(Array.isArray(read.snapshots[0].ratings)).toBe(true);
    expect("accounts" in read.snapshots[0]).toBe(false);
  });

  it("reads a v2 document verbatim", () => {
    const v2 = { version: 2, snapshots: [{ playerId: "a", date: "2026-10-31", accounts: {} }] };
    const read = readExistingDocument(v2);

    expect(read.version).toBe(2);
    expect(read.snapshots[0]).toBe(v2.snapshots[0]);
  });
});

describe("mergeSnapshots with mixed shapes", () => {
  const storedV1 = {
    playerId: "old",
    date: "2026-10-01",
    ratings: [{ username: "x", platform: "lichess", category: "rapid", rating: 1500 }]
  };
  const storedV2 = {
    playerId: "recent",
    date: "2026-10-30",
    accounts: { lichess: { username: "y", ratings: { rapid: 1600 }, unplayed: ["puzzle"] } }
  };

  it("keeps previously stored v1 and v2 entries while replacing same-day ones", () => {
    const sameDay = { playerId: "recent", date: "2026-10-31", accounts: {} };
    const staleSameDay = { playerId: "recent", date: "2026-10-31", accounts: { old: true } };

    const merged = mergeSnapshots([storedV1, storedV2, staleSameDay], [sameDay], "2026-10-31", false);

    expect(merged.snapshots).toHaveLength(3);
    // The v1 entry is carried through verbatim — not normalised.
    expect(merged.snapshots[0]).toBe(storedV1);
    expect(Array.isArray(merged.snapshots[0].ratings)).toBe(true);
    expect(merged.snapshots[1]).toBe(storedV2);
    expect(merged.snapshots[2]).toBe(sameDay);
  });

  it("clears everything when reset is set", () => {
    const merged = mergeSnapshots([storedV1, storedV2], [], "2026-10-31", true);
    expect(merged.snapshots).toEqual([]);
  });
});

describe("formerIds remapping against both shapes", () => {
  const players = [
    { id: "beeba", name: "Beeba", chessCom: "unlikelyeffect" },
    { id: "wealth", name: "Wealth" }
  ];

  it("remaps a v2 entry without assuming a top-level ratings array", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    const snapshots = [
      { playerId: "unlikelyeffect", date: "2026-10-31", accounts: { lichess: { username: "z", ratings: {}, unplayed: [] } } }
    ];

    const result = remapFormerIds(snapshots, map) as Array<{ playerId: string; accounts: unknown }>;
    expect(result[0].playerId).toBe("beeba");
    expect(result[0].accounts).toBe(snapshots[0].accounts);
  });

  it("remaps a v1 entry unchanged otherwise", () => {
    const map = buildFormerIdMap(players, { beeba: ["unlikelyeffect"] });
    const snapshots = [{ playerId: "unlikelyeffect", date: "2026-10-01", ratings: [] }];

    const result = remapFormerIds(snapshots, map) as Array<{ playerId: string }>;
    expect(result[0].playerId).toBe("beeba");
  });
});
