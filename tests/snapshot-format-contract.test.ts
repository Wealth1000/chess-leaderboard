import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { decodeSnapshotDocument, encodeSnapshotDocument } from "@/lib/snapshot-format";
import type { Snapshot } from "@/lib/types";

/**
 * The cross-boundary contract test.
 *
 * The fetcher (`scripts/fetch-ratings.js`, CommonJS) writes the gist and the
 * site (`lib/snapshot-format.ts`, TypeScript) reads it. The format logic exists
 * twice on purpose, so this is the only thing keeping the two halves from
 * drifting apart: we encode with the fetcher's own exports and decode with the
 * site's decoder (and vice versa). No encoder is reimplemented here — a copy
 * would defeat the whole point.
 */
const require = createRequire(import.meta.url);
const {
  buildV2Account,
  buildV2Snapshot,
  buildDocument,
  encodeDocument,
  isV2Entry,
  isV2Document,
  readExistingDocument
} = require("../scripts/fetch-ratings.js") as {
  buildV2Account: (
    username: string,
    ratings: Record<string, number | null>,
    gamesPlayed: Record<string, number>
  ) => Record<string, unknown>;
  buildV2Snapshot: (
    playerId: string,
    date: string,
    accounts: Record<string, unknown>,
    chessComExtras: { tacticsHigh: number | null; puzzleRushBest: number | null } | null
  ) => Record<string, unknown>;
  buildDocument: (snapshots: unknown[]) => { version: number; snapshots: unknown[] };
  encodeDocument: (input: unknown) => string;
  isV2Entry: (entry: unknown) => boolean;
  isV2Document: (document: unknown) => boolean;
  readExistingDocument: (parsed: unknown) => {
    version: 2 | null;
    snapshots: Array<Record<string, unknown>>;
  };
};

function findRating(
  snapshots: Snapshot[],
  playerId: string,
  platform: string,
  category: string
) {
  const snapshot = snapshots.find(s => s.playerId === playerId);
  return snapshot?.ratings.find(
    r => r.platform === platform && r.category === category
  );
}

/** A legacy v1 entry: the shape already sitting in the live gist, untouched. */
const legacyV1Entry = {
  playerId: "wealth",
  playerName: "Wealth",
  date: "2026-10-22",
  ratings: [
    {
      username: "wealth98981",
      platform: "chess.com",
      category: "rapid",
      rating: 1720
    },
    {
      username: "wealth98981",
      platform: "chess.com",
      category: "puzzle",
      rating: null
    }
  ],
  chessComExtras: { tacticsHigh: 1900, puzzleRushBest: 42 }
};

describe("contract — fetcher encodes, site decodes", () => {
  // Build the exact entry the fetcher would write for a member.
  const chessComAccount = buildV2Account(
    "mr_wiafe",
    { rapid: 2114, classical: 529, blitz: 1851, bullet: 1081, puzzle: null },
    { rapid: 3712, classical: 137, blitz: 2988, bullet: 1067 }
  );
  const fetcherSnapshot = buildV2Snapshot(
    "wiafe",
    "2026-10-31",
    { "chess.com": chessComAccount },
    { tacticsHigh: 1554, puzzleRushBest: null }
  );
  const encoded = encodeDocument([fetcherSnapshot]);

  const decoded = decodeSnapshotDocument(JSON.parse(encoded));

  it("writes a minified version 2 document", () => {
    expect(encoded).not.toContain("\n");
    expect(encoded).not.toContain("  ");
    const parsed = JSON.parse(encoded);
    expect(parsed.version).toBe(2);
    expect(Array.isArray(parsed.snapshots)).toBe(true);
  });

  it("decodes one domain snapshot preserving id and date", () => {
    expect(decoded).toHaveLength(1);
    expect(decoded[0].playerId).toBe("wiafe");
    expect(decoded[0].date).toBe("2026-10-31");
  });

  it("preserves each rating's numeric value and the account username", () => {
    const rapid = findRating(decoded, "wiafe", "chess.com", "rapid");
    expect(rapid?.rating).toBe(2114);
    expect(rapid?.username).toBe("mr_wiafe");

    expect(findRating(decoded, "wiafe", "chess.com", "classical")?.rating).toBe(529);
    expect(findRating(decoded, "wiafe", "chess.com", "blitz")?.rating).toBe(1851);
    expect(findRating(decoded, "wiafe", "chess.com", "bullet")?.rating).toBe(1081);
  });

  it("preserves chessComExtras including an explicit null", () => {
    expect(decoded[0].chessComExtras).toEqual({
      tacticsHigh: 1554,
      puzzleRushBest: null
    });
  });

  it("preserves the three-way played / unplayed / absent distinction", () => {
    // 1. A rated category decodes with its numeric value.
    const rapid = findRating(decoded, "wiafe", "chess.com", "rapid");
    expect(rapid?.rating).toBe(2114);

    // 2. A category the fetcher listed in `unplayed` decodes with a null entry.
    const puzzle = findRating(decoded, "wiafe", "chess.com", "puzzle");
    expect(puzzle).toBeDefined();
    expect(puzzle?.rating).toBeNull();

    // 3. A category in neither `ratings` nor `unplayed` emits no entry at all.
    //    The fetcher's builder always enumerates every category (so a v2 entry
    //    it writes never has this gap), but the site decoder must still honour
    //    the storage contract for a hand-written or future entry.
    const absent = decodeSnapshotDocument({
      version: 2,
      snapshots: [
        {
          playerId: "gap",
          date: "2026-10-31",
          accounts: {
            "chess.com": {
              username: "gap_user",
              ratings: { rapid: 1500 },
              unplayed: ["puzzle"]
            }
          }
        }
      ]
    });
    expect(findRating(absent, "gap", "chess.com", "rapid")?.rating).toBe(1500);
    expect(findRating(absent, "gap", "chess.com", "puzzle")?.rating).toBeNull();
    // `blitz` / `bullet` / `classical` appear in neither map -> no entry.
    expect(findRating(absent, "gap", "chess.com", "blitz")).toBeUndefined();
    expect(findRating(absent, "gap", "chess.com", "bullet")).toBeUndefined();
    expect(findRating(absent, "gap", "chess.com", "classical")).toBeUndefined();
  });

  it("preserves gamesPlayed when known and leaves it undefined when not", () => {
    const rapid = findRating(decoded, "wiafe", "chess.com", "rapid");
    expect(rapid?.gamesPlayed).toBe(3712);

    // `puzzle` is unplayed: no count was ever attached, and it must not become 0.
    const puzzle = findRating(decoded, "wiafe", "chess.com", "puzzle");
    expect(puzzle?.gamesPlayed).toBeUndefined();

    // A rated category with no count at all must also stay undefined.
    const sparseAccount = buildV2Account(
      "sparse",
      { rapid: 1500, classical: null, blitz: 1600, bullet: null, puzzle: null },
      { rapid: 42 }
    );
    const sparse = decodeSnapshotDocument(
      JSON.parse(
        encodeDocument([buildV2Snapshot("sparse", "2026-10-31", { "chess.com": sparseAccount }, null)])
      )
    );

    expect(findRating(sparse, "sparse", "chess.com", "rapid")?.gamesPlayed).toBe(42);
    const blitz = findRating(sparse, "sparse", "chess.com", "blitz");
    expect(blitz?.rating).toBe(1600);
    expect(blitz?.gamesPlayed).toBeUndefined();
    expect(blitz?.gamesPlayed).not.toBe(0);
  });
});

describe("contract — site encodes, fetcher reads", () => {
  const domain: Snapshot[] = [
    {
      playerId: "wiafe",
      playerName: "Wiafe",
      date: "2026-10-31",
      chessComExtras: { tacticsHigh: 1554, puzzleRushBest: null },
      ratings: [
        {
          username: "mr_wiafe",
          platform: "chess.com",
          category: "rapid",
          rating: 2114,
          gamesPlayed: 3712
        },
        {
          username: "mr_wiafe",
          platform: "chess.com",
          category: "puzzle",
          rating: null
        },
        {
          username: "wiafe_li",
          platform: "lichess",
          category: "blitz",
          rating: 1800,
          gamesPlayed: 900
        }
      ]
    }
  ];

  const encodedBySite = encodeSnapshotDocument(domain);
  const parsed = JSON.parse(encodedBySite);
  const read = readExistingDocument(parsed);

  it("emits a document the fetcher recognises as v2", () => {
    expect(encodedBySite).not.toContain("\n");
    expect(isV2Document(parsed)).toBe(true);
    expect(read.version).toBe(2);
  });

  it("emits entries the fetcher recognises as v2, per entry", () => {
    expect(read.snapshots).toHaveLength(1);
    for (const entry of read.snapshots) {
      expect(isV2Entry(entry)).toBe(true);
    }
  });

  it("agrees on the wire shape: accounts keyed by platform, username, ratings, unplayed", () => {
    const [entry] = read.snapshots;
    expect(entry.playerId).toBe("wiafe");
    expect(entry.date).toBe("2026-10-31");

    const accounts = entry.accounts as Record<string, Record<string, unknown>>;
    const chessCom = accounts["chess.com"];
    expect(chessCom.username).toBe("mr_wiafe");
    expect(chessCom.ratings).toEqual({ rapid: 2114 });
    expect(chessCom.unplayed).toEqual(["puzzle"]);
    expect(chessCom.gamesPlayed).toEqual({ rapid: 3712 });

    const lichess = accounts.lichess;
    expect(lichess.username).toBe("wiafe_li");
    expect(lichess.ratings).toEqual({ blitz: 1800 });
    expect(lichess.gamesPlayed).toEqual({ blitz: 900 });

    expect(entry.chessComExtras).toEqual({ tacticsHigh: 1554, puzzleRushBest: null });
  });

  it("round-trips through the site decoder unchanged", () => {
    const back = decodeSnapshotDocument(JSON.parse(encodedBySite));
    expect(findRating(back, "wiafe", "chess.com", "rapid")?.rating).toBe(2114);
    expect(findRating(back, "wiafe", "chess.com", "rapid")?.gamesPlayed).toBe(3712);
    expect(findRating(back, "wiafe", "chess.com", "puzzle")?.rating).toBeNull();
    expect(findRating(back, "wiafe", "lichess", "blitz")?.rating).toBe(1800);
    expect(findRating(back, "wiafe", "lichess", "blitz")?.gamesPlayed).toBe(900);
  });
});

describe("contract — mixed v1 and v2 document (live transition state)", () => {
  it("decodes both entries when a legacy v1 entry sits beside a fetcher-built v2 entry", () => {
    const v2Account = buildV2Account(
      "mr_wiafe",
      { rapid: 2114, classical: 529, blitz: 1851, bullet: 1081, puzzle: null },
      { rapid: 3712 }
    );
    const v2Entry = buildV2Snapshot(
      "wiafe",
      "2026-10-31",
      { "chess.com": v2Account },
      { tacticsHigh: 1554, puzzleRushBest: null }
    );

    // Exactly what the fetcher writes: the stored v1 entry verbatim, plus the
    // entry it just built. `buildDocument` wraps both under version 2.
    const document = buildDocument([legacyV1Entry, v2Entry]);
    const decoded = decodeSnapshotDocument(JSON.parse(encodeDocument(document)));

    expect(decoded).toHaveLength(2);
    expect(decoded.map(s => s.playerId)).toEqual(["wealth", "wiafe"]);

    // The v1 entry keeps its explicit null and gains no gamesPlayed.
    const legacyPuzzle = findRating(decoded, "wealth", "chess.com", "puzzle");
    expect(legacyPuzzle?.rating).toBeNull();
    expect(legacyPuzzle?.gamesPlayed).toBeUndefined();
    expect(findRating(decoded, "wealth", "chess.com", "rapid")?.rating).toBe(1720);

    // The v2 entry decodes with its count.
    expect(findRating(decoded, "wiafe", "chess.com", "rapid")?.rating).toBe(2114);
    expect(findRating(decoded, "wiafe", "chess.com", "rapid")?.gamesPlayed).toBe(3712);
    expect(findRating(decoded, "wiafe", "chess.com", "puzzle")?.rating).toBeNull();
  });
});

describe("contract — empty and malformed input degrades to []", () => {
  it("returns [] for an empty v2 document", () => {
    expect(decodeSnapshotDocument({ version: 2, snapshots: [] })).toEqual([]);
  });

  it("returns [] without throwing for malformed input", () => {
    const malformed: unknown[] = [
      null,
      "snapshots",
      {},
      { version: 3, snapshots: [] }
    ];

    for (const input of malformed) {
      expect(() => decodeSnapshotDocument(input)).not.toThrow();
      expect(decodeSnapshotDocument(input)).toEqual([]);
    }
  });

  it("still applies the boundary rules the fetcher relies on", () => {
    // Sanity-check the fetcher's own readers against the same hostile inputs so
    // the two sides agree on what a document even is.
    expect(readExistingDocument(null).snapshots).toEqual([]);
    expect(readExistingDocument("nope").snapshots).toEqual([]);
    expect(isV2Document({ version: 3, snapshots: [] })).toBe(false);
  });
});
