import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * One Chess.com failure must not erase a rating permanently. The fetcher keeps
 * the newest earlier account entry with a real number, skipping the empty
 * entries written by failed runs.
 */
const require = createRequire(import.meta.url);

type Account = {
  username: string;
  ratings: Record<string, number>;
  unplayed: string[];
};

type StoredSnapshot = {
  playerId: string;
  date: string;
  accounts?: Record<string, Account>;
  ratings?: Array<{
    username: string;
    platform: string;
    category: string;
    rating: number | null;
  }>;
};

const { latestAccount, carryForwardAccount } = require(
  "../scripts/fetch-ratings.js",
) as {
  latestAccount: (
    snapshots: StoredSnapshot[],
    playerId: string,
    platform: string,
  ) => { date: string; account: Account } | null;
  carryForwardAccount: (
    player: { id: string },
    platform: string,
    snapshots: StoredSnapshot[],
    username: string,
  ) => { date: string; account: Account } | null;
};

function account(username: string, rapid: number | null): Account {
  return {
    username,
    ratings: rapid == null ? {} : { rapid },
    unplayed: rapid == null ? ["rapid"] : [],
  };
}

describe("carrying a rating through a failed fetch", () => {
  const snapshots: StoredSnapshot[] = [
    {
      playerId: "beeba",
      date: "2026-10-29",
      accounts: { "chess.com": account("unlikelyeffect", 1564) },
    },
    {
      playerId: "beeba",
      date: "2026-10-31",
      accounts: { "chess.com": account("unlikelyeffect", 1572) },
    },
    {
      playerId: "beeba",
      date: "2026-11-01",
      accounts: { "chess.com": account("unlikelyeffect", null) },
    },
  ];

  it("returns the newest earlier entry that still has a numeric rating", () => {
    expect(latestAccount(snapshots, "beeba", "chess.com")).toEqual({
      date: "2026-10-31",
      account: account("unlikelyeffect", 1572),
    });
  });

  it("carries the rating forward when the handle is unchanged", () => {
    expect(
      carryForwardAccount(
        { id: "beeba" },
        "chess.com",
        snapshots,
        "unlikelyeffect",
      )?.date,
    ).toBe("2026-10-31");
  });

  it("refuses to borrow ratings across a changed handle", () => {
    expect(
      carryForwardAccount(
        { id: "beeba" },
        "chess.com",
        snapshots,
        "different-handle",
      ),
    ).toBeNull();
  });

  it("returns null when every stored entry is empty", () => {
    const empty: StoredSnapshot[] = [
      {
        playerId: "ghost",
        date: "2026-11-01",
        accounts: { "chess.com": account("ghost", null) },
      },
    ];
    expect(latestAccount(empty, "ghost", "chess.com")).toBeNull();
  });

  it("reads legacy v1 snapshots but ignores other players", () => {
    const legacy: StoredSnapshot[] = [
      {
        playerId: "beeba",
        date: "2026-10-20",
        ratings: [
          {
            username: "unlikelyeffect",
            platform: "chess.com",
            category: "rapid",
            rating: 1500,
          },
        ],
      },
      {
        playerId: "someone-else",
        date: "2026-10-31",
        accounts: { "chess.com": account("unlikelyeffect", 1600) },
      },
    ];

    const found = latestAccount(legacy, "beeba", "chess.com");
    expect(found?.date).toBe("2026-10-20");
    expect(found?.account.username).toBe("unlikelyeffect");
    expect(found?.account.ratings.rapid).toBe(1500);
  });

  it("carries a legacy v1 rating forward when the handle matches", () => {
    const legacy: StoredSnapshot[] = [
      {
        playerId: "beeba",
        date: "2026-10-31",
        ratings: [
          {
            username: "unlikelyeffect",
            platform: "chess.com",
            category: "rapid",
            rating: 1572,
          },
        ],
      },
    ];

    expect(
      carryForwardAccount(
        { id: "beeba" },
        "chess.com",
        legacy,
        "unlikelyeffect",
      )?.date,
    ).toBe("2026-10-31");
  });
});
