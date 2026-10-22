import { describe, expect, it } from "vitest";
import { buildRatingsView, DEFAULT_VIEW_STATE } from "@/lib/ratings-view";
import type {
  Category,
  ChessComExtras,
  Platform,
  Player,
  PlayerRating,
  Snapshot,
  ViewState,
} from "@/lib/types";

type RatingSpec = {
  platform: Platform;
  category: Category;
  rating: number | null;
};

function player(
  id: string,
  name: string,
  handles: { chessCom?: string; lichess?: string } = {},
): Player {
  return { id, name, ...handles };
}

function rating(
  platform: Platform,
  category: Category,
  value: number | null,
): RatingSpec {
  return { platform, category, rating: value };
}

function snapshot(
  entry: Player,
  date: string,
  ratings: RatingSpec[],
  chessComExtras?: ChessComExtras | null,
): Snapshot {
  const mapped: PlayerRating[] = ratings.map((value) => ({
    ...value,
    username:
      value.platform === "chess.com"
        ? entry.chessCom ?? entry.id
        : entry.lichess ?? entry.id,
  }));

  return {
    playerId: entry.id,
    playerName: entry.name,
    date,
    ratings: mapped,
    chessComExtras,
  };
}

function view(overrides: Partial<ViewState> = {}): ViewState {
  return { ...DEFAULT_VIEW_STATE, ...overrides };
}

function findPlayer(
  model: ReturnType<typeof buildRatingsView>,
  playerId: string,
) {
  return model.ranked.find((entry) => entry.id === playerId);
}

function scorecard(
  model: ReturnType<typeof buildRatingsView>,
  playerId: string,
) {
  const card = model.scorecards[playerId];
  if (!card) throw new Error(`Missing scorecard for ${playerId}`);
  return card;
}

function matrixRow(
  model: ReturnType<typeof buildRatingsView>,
  playerId: string,
  category: Category,
) {
  const row = scorecard(model, playerId).matrix.find(
    (entry) => entry.category === category,
  );
  if (!row) throw new Error(`Missing matrix row for ${category}`);
  return row;
}

describe("category ratings", () => {
  it("selects the requested category and never falls back to blitz", () => {
    const alpha = player("alpha", "Alpha", { chessCom: "alpha" });
    const beta = player("beta", "Beta", { chessCom: "beta" });
    const snapshots = [
      snapshot(alpha, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
        rating("chess.com", "blitz", 582),
      ]),
      snapshot(beta, "2026-10-22", [
        rating("chess.com", "rapid", null),
        rating("chess.com", "blitz", 1900),
      ]),
    ];

    const rapid = buildRatingsView(
      [alpha, beta],
      snapshots,
      view({ platform: "chess.com", category: "rapid" }),
    );

    expect(findPlayer(rapid, "alpha")?.rating).toBe(1300);
    expect(findPlayer(rapid, "beta")?.rating).toBeNull();
    expect(rapid.rated.map((entry) => entry.id)).toEqual(["alpha"]);
    expect(rapid.leader?.id).toBe("alpha");

    const blitz = buildRatingsView(
      [alpha, beta],
      snapshots,
      view({ platform: "chess.com", category: "blitz" }),
    );

    expect(findPlayer(blitz, "alpha")?.rating).toBe(582);
    expect(findPlayer(blitz, "beta")?.rating).toBe(1900);
    expect(blitz.leader?.id).toBe("beta");
  });

  it("maps Chess.com Daily and Lichess classical to the classical category", () => {
    const member = player("member", "Member", {
      chessCom: "daily-player",
      lichess: "classical-player",
    });
    const snapshots = [
      snapshot(member, "2026-10-22", [
        rating("chess.com", "classical", 1800),
        rating("lichess", "classical", 2010),
        rating("chess.com", "rapid", null),
        rating("lichess", "rapid", null),
      ]),
    ];

    const chessCom = buildRatingsView(
      [member],
      snapshots,
      view({ platform: "chess.com", category: "classical" }),
    );
    expect(chessCom.leader?.rating).toBe(1800);
    expect(
      matrixRow(chessCom, "member", "classical").cells["chess.com"].reason,
    ).toBe("rated");

    const lichess = buildRatingsView(
      [member],
      snapshots,
      view({ platform: "lichess", category: "classical" }),
    );
    expect(lichess.leader?.rating).toBe(2010);
  });

  it("uses Lichess puzzle ratings and treats zero-game categories as unplayed", () => {
    const member = player("member", "Member", { lichess: "puzzler" });
    const snapshots = [
      snapshot(member, "2026-10-22", [
        rating("lichess", "puzzle", 2150),
        rating("lichess", "rapid", null),
      ]),
    ];

    const puzzle = buildRatingsView(
      [member],
      snapshots,
      view({ platform: "lichess", category: "puzzle" }),
    );

    expect(puzzle.leader?.rating).toBe(2150);
    expect(puzzle.field.hasData).toBe(true);
    expect(puzzle.field.series[0].points).toEqual([
      { date: "2026-10-22", value: 2150 },
    ]);
    expect(matrixRow(puzzle, "member", "puzzle").cells.lichess.reason).toBe(
      "rated",
    );
    expect(matrixRow(puzzle, "member", "rapid").cells.lichess.reason).toBe(
      "not-played",
    );

    const rapid = buildRatingsView(
      [member],
      snapshots,
      view({ platform: "lichess", category: "rapid" }),
    );

    expect(rapid.ratedCount).toBe(0);
    expect(rapid.leader).toBeNull();
    expect(rapid.scorecards.member.currentRating).toBeNull();
    expect(rapid.scorecards.member.change.direction).toBe("unavailable");
  });

  it("marks Chess.com puzzle unavailable while keeping tactics and Puzzle Rush extras", () => {
    const member = player("member", "Member", {
      chessCom: "tactician",
      lichess: "puzzler",
    });
    const extras: ChessComExtras = { tacticsHigh: 1800, puzzleRushBest: 32 };
    const snapshots = [
      snapshot(
        member,
        "2026-10-22",
        [
          rating("chess.com", "puzzle", null),
          rating("lichess", "puzzle", 2200),
        ],
        extras,
      ),
    ];

    const model = buildRatingsView(
      [member],
      snapshots,
      view({ platform: "chess.com", category: "puzzle" }),
    );

    expect(model.notice).toEqual({ kind: "chesscom-puzzle" });
    expect(model.ratedCount).toBe(0);
    expect(model.leader).toBeNull();

    const card = scorecard(model, "member");
    expect(matrixRow(model, "member", "puzzle").cells["chess.com"]).toMatchObject(
      {
        rating: null,
        reason: "not-published",
      },
    );
    expect(card.chessComExtras).toEqual(extras);
    expect(card.activeCell).toMatchObject({
      platform: "chess.com",
      category: "puzzle",
      reason: "not-published",
      active: true,
    });
    expect(card.matrix.find((row) => row.category === "puzzle")?.cells.lichess)
      .toMatchObject({ rating: 2200, reason: "rated" });
  });
});

describe("latest ranking", () => {
  it("ranks latest ratings descending and orders unrated players by name", () => {
    const zoe = player("zoe", "Zoe");
    const amy = player("amy", "Amy");
    const bob = player("bob", "Bob");
    const cal = player("cal", "Cal");
    const snapshots = [
      snapshot(zoe, "2026-10-22", [rating("chess.com", "rapid", 1500)]),
      snapshot(amy, "2026-10-22", [rating("chess.com", "rapid", 1800)]),
      snapshot(bob, "2026-10-22", [rating("chess.com", "rapid", null)]),
      snapshot(cal, "2026-10-22", []),
    ];

    const model = buildRatingsView(
      [zoe, amy, bob, cal],
      snapshots,
      view(),
    );

    expect(model.ranked.map((entry) => entry.name)).toEqual([
      "Amy",
      "Zoe",
      "Bob",
      "Cal",
    ]);
    expect(model.ranked.map((entry) => entry.rank)).toEqual([1, 2, 0, 0]);
    expect(model.ratedCount).toBe(2);
    expect(model.leader?.id).toBe("amy");
    expect(model.average).toBe(1650);
    expect(model.top10).toBe(1500);
  });
});

describe("range comparison", () => {
  it("uses the closest snapshot on or before the finite-range target date", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-09-20", [
        rating("chess.com", "rapid", 1100),
      ]),
      snapshot(member, "2026-10-10", [
        rating("chess.com", "rapid", 1200),
      ]),
      snapshot(member, "2026-10-14", [
        rating("chess.com", "rapid", 1250),
      ]),
      snapshot(member, "2026-10-16", [
        rating("chess.com", "rapid", 1270),
      ]),
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
      ]),
    ];

    const sevenDay = buildRatingsView(
      [member],
      snapshots,
      view({ range: "7d" }),
    );

    expect(sevenDay.latestDate).toBe("2026-10-22");
    expect(sevenDay.targetDate).toBe("2026-10-15");
    expect(sevenDay.leader?.change).toEqual({
      delta: 50,
      direction: "up",
      comparisonDate: "2026-10-14",
      latestDate: "2026-10-22",
    });
    expect(sevenDay.changesAvailable).toBe(true);

    const thirtyDay = buildRatingsView(
      [member],
      snapshots,
      view({ range: "30d" }),
    );

    expect(thirtyDay.targetDate).toBe("2026-09-22");
    expect(thirtyDay.leader?.change.comparisonDate).toBe("2026-09-20");
    expect(thirtyDay.leader?.change.delta).toBe(200);
  });

  it("falls back to the earliest snapshot when the range reaches past stored history", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-10-15", [rating("chess.com", "rapid", 1900)]),
      snapshot(member, "2026-10-22", [rating("chess.com", "rapid", 1920)]),
    ];

    const sevenDay = buildRatingsView(
      [member],
      snapshots,
      view({ range: "7d" }),
    );
    expect(sevenDay.leader?.change).toMatchObject({
      delta: 20,
      comparisonDate: "2026-10-15",
    });

    // The 30D target (22 Sep) predates every stored snapshot, so the change
    // still uses the earliest available snapshot rather than "unavailable".
    const thirtyDay = buildRatingsView(
      [member],
      snapshots,
      view({ range: "30d" }),
    );
    expect(thirtyDay.targetDate).toBe("2026-09-22");
    expect(thirtyDay.leader?.change).toMatchObject({
      delta: 20,
      direction: "up",
      comparisonDate: "2026-10-15",
    });

    const ninetyDay = buildRatingsView(
      [member],
      snapshots,
      view({ range: "90d" }),
    );
    expect(ninetyDay.leader?.change).toMatchObject({
      delta: 20,
      comparisonDate: "2026-10-15",
    });
  });

  it("compares the All range against the first rated snapshot", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-09-15", [
        rating("chess.com", "rapid", null),
      ]),
      snapshot(member, "2026-10-01", [
        rating("chess.com", "rapid", 1000),
      ]),
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
      ]),
    ];

    const model = buildRatingsView(
      [member],
      snapshots,
      view({ range: "all" }),
    );

    expect(model.targetDate).toBeNull();
    expect(model.leader?.change.comparisonDate).toBe("2026-10-01");
    expect(model.leader?.change.delta).toBe(300);
    expect(model.leader?.change.direction).toBe("up");
  });

  it("reports positive, negative, zero, and unavailable changes", () => {
    const up = player("up", "Up");
    const down = player("down", "Down");
    const flat = player("flat", "Flat");
    const single = player("single", "Single");
    const snapshots = [
      snapshot(up, "2026-10-01", [rating("chess.com", "rapid", 1000)]),
      snapshot(up, "2026-10-22", [rating("chess.com", "rapid", 1050)]),
      snapshot(down, "2026-10-01", [rating("chess.com", "rapid", 1100)]),
      snapshot(down, "2026-10-22", [rating("chess.com", "rapid", 1080)]),
      snapshot(flat, "2026-10-01", [rating("chess.com", "rapid", 1200)]),
      snapshot(flat, "2026-10-22", [rating("chess.com", "rapid", 1200)]),
      snapshot(single, "2026-10-22", [rating("chess.com", "rapid", 1300)]),
    ];

    const model = buildRatingsView(
      [up, down, flat, single],
      snapshots,
      view({ range: "all" }),
    );

    expect(findPlayer(model, "up")?.change).toMatchObject({
      delta: 50,
      direction: "up",
    });
    expect(findPlayer(model, "down")?.change).toMatchObject({
      delta: -20,
      direction: "down",
    });
    expect(findPlayer(model, "flat")?.change).toMatchObject({
      delta: 0,
      direction: "flat",
    });
    expect(findPlayer(model, "single")?.change).toMatchObject({
      delta: null,
      direction: "unavailable",
      comparisonDate: null,
    });
    expect(model.changesAvailable).toBe(true);
  });

  it("reports unavailable rather than flat when only one snapshot exists", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1500),
      ]),
    ];

    const model = buildRatingsView([member], snapshots, view());

    expect(model.hasSnapshots).toBe(true);
    expect(model.leader?.change.direction).toBe("unavailable");
    expect(model.leader?.change.delta).toBeNull();
    expect(model.leader?.change.comparisonDate).toBeNull();
    expect(model.changesAvailable).toBe(false);
  });
});

describe("field chart", () => {
  it("filters raw rating series to the selected range", () => {
    const member = player("member", "Member");
    const old = player("old", "Old");
    const snapshots = [
      snapshot(member, "2026-09-01", [
        rating("chess.com", "rapid", 1000),
      ]),
      snapshot(member, "2026-10-01", [
        rating("chess.com", "rapid", 1100),
      ]),
      snapshot(member, "2026-10-20", [
        rating("chess.com", "rapid", 1200),
      ]),
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
      ]),
      snapshot(old, "2026-09-01", [
        rating("chess.com", "rapid", 900),
      ]),
    ];

    const sevenDay = buildRatingsView(
      [member, old],
      snapshots,
      view({ range: "7d" }),
    );

    expect(sevenDay.targetDate).toBe("2026-10-15");
    expect(sevenDay.field.dates).toEqual(["2026-10-20", "2026-10-22"]);
    expect(sevenDay.field.series).toHaveLength(1);
    expect(sevenDay.field.series[0]).toMatchObject({
      playerId: "member",
      latestValue: 1300,
      points: [
        { date: "2026-10-20", value: 1200 },
        { date: "2026-10-22", value: 1300 },
      ],
    });

    const all = buildRatingsView(
      [member, old],
      snapshots,
      view({ range: "all" }),
    );

    expect(all.field.dates).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-10-20",
      "2026-10-22",
    ]);
    expect(all.field.series.map((series) => series.playerId)).toEqual([
      "member",
      "old",
    ]);
    expect(all.field.leaders).toHaveLength(2);
  });
});

describe("focus mode", () => {
  it("starts the baseline at the first rated snapshot inside the range", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-09-01", [
        rating("chess.com", "rapid", 1000),
      ]),
      snapshot(member, "2026-10-18", [
        rating("chess.com", "rapid", 1200),
      ]),
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
      ]),
    ];

    const model = buildRatingsView(
      [member],
      snapshots,
      view({ range: "7d", focusPlayerId: "member" }),
    );

    expect(model.focus).toMatchObject({
      playerId: "member",
      missingRating: false,
      baselineDate: "2026-10-18",
      baselineRating: 1200,
      currentRating: 1300,
      totalChange: 100,
      groupSize: 1,
      smallGroup: true,
    });
    expect(model.focus?.focusSeries?.points).toEqual([
      { date: "2026-10-18", value: 0 },
      { date: "2026-10-22", value: 100 },
    ]);
    expect(model.focus?.dates).toEqual(["2026-10-18", "2026-10-22"]);
  });

  it("selects peers within ±200, nearest first, and caps the group at eight", () => {
    const focus = player("focus", "Focus");
    const candidates = [
      player("p1", "A One"),
      player("p2", "B Two"),
      player("p3", "C Three"),
      player("p4", "D Four"),
      player("p5", "E Five"),
      player("p6", "F Six"),
      player("p7", "G Seven"),
      player("p8", "H Eight"),
      player("p9", "I Nine"),
      player("far", "Z Far"),
    ];
    const ratings = [
      990, 1010, 950, 1050, 900, 1100, 850, 1150, 800, 1201,
    ];
    const snapshots = [
      snapshot(focus, "2026-10-22", [
        rating("chess.com", "rapid", 1000),
      ]),
      ...candidates.map((entry, index) =>
        snapshot(entry, "2026-10-22", [
          rating("chess.com", "rapid", ratings[index]),
        ]),
      ),
    ];

    const model = buildRatingsView(
      [focus, ...candidates],
      snapshots,
      view({ focusPlayerId: "focus" }),
    );

    expect(model.focus?.peers).toHaveLength(8);
    expect(model.focus?.peers.map((peer) => peer.playerId)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
    ]);
    expect(model.focus?.peers.map((peer) => peer.distance)).toEqual([
      10, 10, 50, 50, 100, 100, 150, 150,
    ]);
    expect(model.focus?.peers.some((peer) => peer.playerId === "far")).toBe(
      false,
    );
    expect(model.focus?.peers.some((peer) => peer.playerId === "p9")).toBe(
      false,
    );
    expect(model.focus?.groupSize).toBe(9);
    expect(model.focus?.smallGroup).toBe(false);
  });

  it("reports the focus summary by growth and flags a small peer group", () => {
    const focus = player("focus", "Focus");
    const first = player("first", "First");
    const second = player("second", "Second");
    const third = player("third", "Third");
    const snapshots = [
      snapshot(focus, "2026-10-01", [rating("chess.com", "rapid", 1000)]),
      snapshot(focus, "2026-10-22", [rating("chess.com", "rapid", 1200)]),
      snapshot(first, "2026-10-01", [rating("chess.com", "rapid", 1050)]),
      snapshot(first, "2026-10-22", [rating("chess.com", "rapid", 1150)]),
      snapshot(second, "2026-10-01", [rating("chess.com", "rapid", 980)]),
      snapshot(second, "2026-10-22", [rating("chess.com", "rapid", 1180)]),
      snapshot(third, "2026-10-01", [rating("chess.com", "rapid", 1020)]),
      snapshot(third, "2026-10-22", [rating("chess.com", "rapid", 1250)]),
    ];

    const model = buildRatingsView(
      [focus, first, second, third],
      snapshots,
      view({ range: "all", focusPlayerId: "focus" }),
    );

    expect(model.focus).toMatchObject({
      baselineDate: "2026-10-01",
      baselineRating: 1000,
      currentRating: 1200,
      totalChange: 200,
      peerAverageChange: 177,
      position: 2,
      groupSize: 4,
      smallGroup: true,
    });
    expect(model.focus?.focusSeries?.points).toEqual([
      { date: "2026-10-01", value: 0 },
      { date: "2026-10-22", value: 200 },
    ]);
    expect(model.focus?.band).toEqual([
      { date: "2026-10-01", min: 0, max: 0 },
      { date: "2026-10-22", min: 100, max: 230 },
    ]);
    expect(model.focus?.peerSeries).toHaveLength(3);
  });

  it("keeps focus selected with an explicit missing-rating state", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1500),
        rating("chess.com", "blitz", null),
      ]),
    ];

    const model = buildRatingsView(
      [member],
      snapshots,
      view({ category: "blitz", focusPlayerId: "member" }),
    );

    expect(model.focus).toMatchObject({
      playerId: "member",
      missingRating: true,
      baselineDate: null,
      baselineRating: null,
      currentRating: null,
      totalChange: null,
      peerAverageChange: null,
      position: null,
      peers: [],
      focusSeries: null,
      peerSeries: [],
      band: [],
    });
    expect(findPlayer(model, "member")?.rating).toBeNull();
  });
});

describe("scorecards", () => {
  it("builds the full matrix with reasons and active-cell information", () => {
    const member = player("member", "Member", {
      chessCom: "daily-player",
      lichess: "puzzle-player",
    });
    const chessComOnly = player("chesscom-only", "Chess.com Only", {
      chessCom: "only-here",
    });
    const extras: ChessComExtras = { tacticsHigh: 1900, puzzleRushBest: 44 };
    const snapshots = [
      snapshot(member, "2026-10-01", [
        rating("chess.com", "rapid", 1250),
        rating("lichess", "rapid", 1450),
      ]),
      snapshot(
        member,
        "2026-10-22",
        [
          rating("chess.com", "rapid", 1300),
          rating("chess.com", "classical", 1400),
          rating("chess.com", "blitz", 500),
          rating("chess.com", "bullet", 450),
          rating("chess.com", "puzzle", null),
          rating("lichess", "rapid", 1500),
          rating("lichess", "classical", null),
          rating("lichess", "puzzle", 2100),
        ],
        extras,
      ),
      snapshot(chessComOnly, "2026-10-22", [
        rating("chess.com", "rapid", 1100),
      ]),
    ];

    const model = buildRatingsView(
      [member, chessComOnly],
      snapshots,
      view({ platform: "chess.com", category: "rapid", range: "7d" }),
    );

    const card = scorecard(model, "member");
    expect(card.matrix.map((row) => row.category)).toEqual([
      "rapid",
      "classical",
      "blitz",
      "bullet",
      "puzzle",
    ]);
    expect(matrixRow(model, "member", "rapid").cells["chess.com"]).toMatchObject(
      {
        rating: 1300,
        reason: "rated",
        active: true,
        username: "daily-player",
      },
    );
    expect(matrixRow(model, "member", "rapid").cells.lichess).toMatchObject({
      rating: 1500,
      reason: "rated",
      active: false,
    });
    expect(
      matrixRow(model, "member", "classical").cells["chess.com"],
    ).toMatchObject({ rating: 1400, reason: "rated" });
    expect(matrixRow(model, "member", "classical").cells.lichess).toMatchObject({
      rating: null,
      reason: "not-played",
    });
    expect(matrixRow(model, "member", "puzzle").cells["chess.com"]).toMatchObject(
      { rating: null, reason: "not-published" },
    );
    expect(matrixRow(model, "member", "puzzle").cells.lichess).toMatchObject({
      rating: 2100,
      reason: "rated",
    });
    expect(matrixRow(model, "member", "bullet").cells.lichess).toMatchObject({
      rating: null,
      reason: "no-data",
    });
    expect(card.activeCell).toMatchObject({
      platform: "chess.com",
      category: "rapid",
      rating: 1300,
      reason: "rated",
      active: true,
    });
    expect(card.currentRating).toBe(1300);
    expect(card.rank).toBe(1);
    expect(card.chessComExtras).toEqual(extras);

    const noAccount = scorecard(model, "chesscom-only");
    expect(matrixRow(model, "chesscom-only", "rapid").cells.lichess).toMatchObject(
      {
        rating: null,
        reason: "no-account",
        username: null,
      },
    );
    expect(noAccount.activeCell).toMatchObject({ rating: 1100, reason: "rated" });
  });

  it("filters active-view history by range and category", () => {
    const member = player("member", "Member");
    const snapshots = [
      snapshot(member, "2026-10-01", [
        rating("chess.com", "rapid", 1200),
        rating("chess.com", "blitz", 500),
      ]),
      snapshot(member, "2026-10-22", [
        rating("chess.com", "rapid", 1300),
        rating("chess.com", "blitz", 600),
      ]),
    ];

    const sevenDayRapid = buildRatingsView(
      [member],
      snapshots,
      view({ category: "rapid", range: "7d" }),
    );
    expect(scorecard(sevenDayRapid, "member").history).toEqual([
      { date: "2026-10-22", rating: 1300 },
    ]);

    const allRapid = buildRatingsView(
      [member],
      snapshots,
      view({ category: "rapid", range: "all" }),
    );
    expect(scorecard(allRapid, "member").history).toEqual([
      { date: "2026-10-01", rating: 1200 },
      { date: "2026-10-22", rating: 1300 },
    ]);

    const sevenDayBlitz = buildRatingsView(
      [member],
      snapshots,
      view({ category: "blitz", range: "7d" }),
    );
    expect(scorecard(sevenDayBlitz, "member").history).toEqual([
      { date: "2026-10-22", rating: 600 },
    ]);
  });
});
