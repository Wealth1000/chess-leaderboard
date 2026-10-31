import { describe, expect, it } from "vitest";

import {
  decodeSnapshotDocument,
  encodeSnapshotDocument
} from "@/lib/snapshot-format";
import type { Snapshot } from "@/lib/types";

const v2Document = {
  version: 2,
  snapshots: [
    {
      playerId: "wiafe",
      date: "2026-10-31",
      accounts: {
        "chess.com": {
          username: "mr_wiafe",
          ratings: { rapid: 2114, classical: 529, blitz: 1851, bullet: 1081 },
          unplayed: ["puzzle"],
          gamesPlayed: { rapid: 3712, classical: 137, blitz: 2988, bullet: 1067 }
        }
      },
      chessComExtras: { tacticsHigh: 1554, puzzleRushBest: null }
    }
  ]
};

const v1Document = {
  snapshots: [
    {
      playerId: "wealth",
      playerName: "Wealth",
      date: "2026-10-22",
      ratings: [
        { username: "wealth98981", platform: "chess.com", category: "rapid", rating: 1720 },
        { username: "wealth98981", platform: "chess.com", category: "puzzle", rating: null }
      ],
      chessComExtras: { tacticsHigh: 1900, puzzleRushBest: 42 }
    }
  ]
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

describe("decodeSnapshotDocument — v2", () => {
  it("decodes a v2 document with gamesPlayed and extras", () => {
    const snapshots = decodeSnapshotDocument(v2Document);
    expect(snapshots).toHaveLength(1);

    const snapshot = snapshots[0];
    expect(snapshot.playerId).toBe("wiafe");
    expect(snapshot.date).toBe("2026-10-31");
    expect(snapshot.chessComExtras).toEqual({
      tacticsHigh: 1554,
      puzzleRushBest: null
    });

    expect(snapshot.ratings).toHaveLength(5);

    const rapid = findRating(snapshots, "wiafe", "chess.com", "rapid");
    expect(rapid).toMatchObject({
      username: "mr_wiafe",
      platform: "chess.com",
      category: "rapid",
      rating: 2114,
      gamesPlayed: 3712
    });
  });

  it("emits a null entry for unplayed, distinct from a category absent from both maps", () => {
    const snapshots = decodeSnapshotDocument({
      version: 2,
      snapshots: [
        {
          playerId: "wiafe",
          date: "2026-10-31",
          accounts: {
            "chess.com": {
              username: "mr_wiafe",
              ratings: { rapid: 2114 },
              unplayed: ["puzzle"]
            }
          }
        }
      ]
    });

    // rapid + puzzle only: `bullet` appears in neither map and emits nothing.
    expect(snapshots[0].ratings).toHaveLength(2);

    const puzzle = findRating(snapshots, "wiafe", "chess.com", "puzzle");
    expect(puzzle).toBeDefined();
    expect(puzzle?.rating).toBeNull();

    const bullet = findRating(snapshots, "wiafe", "chess.com", "bullet");
    expect(bullet).toBeUndefined();
  });

  it("does not invent gamesPlayed for a rated category with no count", () => {
    const snapshots = decodeSnapshotDocument({
      version: 2,
      snapshots: [
        {
          playerId: "wiafe",
          date: "2026-10-31",
          accounts: {
            "chess.com": {
              username: "mr_wiafe",
              ratings: { rapid: 2114 },
              gamesPlayed: { bullet: 10 }
            }
          }
        }
      ]
    });
    const rapid = findRating(snapshots, "wiafe", "chess.com", "rapid");
    expect(rapid && "gamesPlayed" in rapid).toBe(false);
  });

  it("decodes multiple platforms in one v2 entry", () => {
    const snapshots = decodeSnapshotDocument({
      version: 2,
      snapshots: [
        {
          playerId: "wiafe",
          date: "2026-10-31",
          accounts: {
            "chess.com": { username: "mr_wiafe", ratings: { rapid: 2114 } },
            lichess: { username: "wiafe_li", ratings: { blitz: 1800 } }
          }
        }
      ]
    });
    expect(findRating(snapshots, "wiafe", "chess.com", "rapid")?.rating).toBe(2114);
    expect(findRating(snapshots, "wiafe", "lichess", "blitz")?.rating).toBe(1800);
  });
});

describe("decodeSnapshotDocument — v1", () => {
  it("decodes a v1 document preserving explicit nulls and no gamesPlayed", () => {
    const snapshots = decodeSnapshotDocument(v1Document);
    expect(snapshots).toHaveLength(1);

    const snapshot = snapshots[0];
    expect(snapshot.playerId).toBe("wealth");
    expect(snapshot.playerName).toBe("Wealth");
    expect(snapshot.date).toBe("2026-10-22");
    expect(snapshot.ratings).toHaveLength(2);

    const puzzle = findRating(snapshots, "wealth", "chess.com", "puzzle");
    expect(puzzle?.rating).toBeNull();
    expect(puzzle && "gamesPlayed" in puzzle).toBe(false);

    const rapid = findRating(snapshots, "wealth", "chess.com", "rapid");
    expect(rapid?.rating).toBe(1720);
    expect(rapid && "gamesPlayed" in rapid).toBe(false);
  });

  it("treats a document with no version as v1", () => {
    const snapshots = decodeSnapshotDocument(v1Document);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].playerId).toBe("wealth");
  });
});

describe("decodeSnapshotDocument — mixed document", () => {
  it("decodes v1 and v2 entries in the same document, per entry", () => {
    const mixed = {
      version: 2,
      snapshots: [
        v1Document.snapshots[0],
        v2Document.snapshots[0]
      ]
    };

    const snapshots = decodeSnapshotDocument(mixed);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map(s => s.playerId)).toEqual(["wealth", "wiafe"]);

    expect(findRating(snapshots, "wealth", "chess.com", "puzzle")?.rating).toBeNull();
    expect(findRating(snapshots, "wiafe", "chess.com", "puzzle")?.rating).toBeNull();
    expect(
      findRating(snapshots, "wiafe", "chess.com", "rapid")?.gamesPlayed
    ).toBe(3712);
  });
});

describe("decodeSnapshotDocument — rejection", () => {
  it("returns [] for an unknown future version", () => {
    expect(
      decodeSnapshotDocument({ version: 3, snapshots: v2Document.snapshots })
    ).toEqual([]);
    expect(
      decodeSnapshotDocument({ version: 99, snapshots: v1Document.snapshots })
    ).toEqual([]);
  });

  it("returns [] without throwing for malformed input", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      "snapshots",
      42,
      [],
      {},
      { version: 2 },
      { snapshots: "nope" },
      { version: 2, snapshots: [{ playerId: "x", date: "2026-10-31", accounts: "nope" }] },
      {
        version: 2,
        snapshots: [
          {
            playerId: "x",
            date: "2026-10-31",
            accounts: { "chess.com": { username: "x", ratings: { rapid: "fast" } } }
          }
        ]
      }
    ];

    for (const input of malformed) {
      expect(() => decodeSnapshotDocument(input)).not.toThrow();
      expect(decodeSnapshotDocument(input)).toEqual([]);
    }
  });
});

describe("encodeSnapshotDocument / decode round trip", () => {
  it("preserves ratings, unplayed-ness, gamesPlayed, extras, ids, and dates", () => {
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
          }
        ]
      }
    ];

    const encoded = encodeSnapshotDocument(domain);
    const decoded = decodeSnapshotDocument(JSON.parse(encoded));

    expect(decoded).toHaveLength(1);
    expect(decoded[0].playerId).toBe("wiafe");
    expect(decoded[0].date).toBe("2026-10-31");
    expect(decoded[0].chessComExtras).toEqual({
      tacticsHigh: 1554,
      puzzleRushBest: null
    });

    const rapid = findRating(decoded, "wiafe", "chess.com", "rapid");
    expect(rapid?.rating).toBe(2114);
    expect(rapid?.gamesPlayed).toBe(3712);

    const puzzle = findRating(decoded, "wiafe", "chess.com", "puzzle");
    expect(puzzle?.rating).toBeNull();
  });

  it("writes a minified document with no newlines", () => {
    const encoded = encodeSnapshotDocument([
      {
        playerId: "wiafe",
        playerName: "Wiafe",
        date: "2026-10-31",
        ratings: [
          {
            username: "mr_wiafe",
            platform: "chess.com",
            category: "rapid",
            rating: 2114
          }
        ]
      }
    ]);
    expect(encoded).not.toContain("\n");
    expect(encoded.length).toBeLessThan(4096);
    expect(JSON.parse(encoded).version).toBe(2);
  });
});
