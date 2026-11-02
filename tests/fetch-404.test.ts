import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * "This account does not exist" and "we could not check" are different facts.
 * The fetcher must only report the first for a 404 whose body really says the
 * user is unknown — Chess.com also answers some existing accounts with a 404
 * whose body says "internal error", and that must never erase their ratings.
 */
const require = createRequire(import.meta.url);

type RequestResult = { status: number | null; json: unknown; body?: string };
type StatsResult = {
  ratings: Record<string, number | null>;
  gamesPlayed: Record<string, number>;
  extras?: { tacticsHigh: number | null; puzzleRushBest: number | null };
  missing: boolean;
  unavailable: boolean;
};

const { fetchChessComStats, fetchLichessStats } = require(
  "../scripts/fetch-ratings.js",
) as {
  fetchChessComStats: (
    username: string,
    request?: () => Promise<RequestResult>,
  ) => Promise<StatsResult>;
  fetchLichessStats: (
    username: string,
    request?: () => Promise<RequestResult>,
  ) => Promise<StatsResult>;
};

function request(status: number | null, json: unknown, body?: string) {
  return async () => ({ status, json, body });
}

describe("fetcher missing-account detection", () => {
  it("marks a Chess.com 404 with a not-found body as a missing account", async () => {
    const result = await fetchChessComStats(
      "ghost",
      request(404, null, '{"code":0,"message":"User \\"ghost\\" not found."}'),
    );

    expect(result.missing).toBe(true);
    expect(result.unavailable).toBe(false);
    expect(result.ratings.rapid).toBeNull();
  });

  it("keeps a Chess.com 404 with an internal-error body as unavailable, not missing", async () => {
    const result = await fetchChessComStats(
      "unlikelyeffect",
      request(
        404,
        null,
        '{"code":0,"message":"An internal error has occurred."}',
      ),
    );

    expect(result.missing).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("treats a 404 with no body as missing for older callers", async () => {
    const result = await fetchChessComStats("ghost", request(404, null));
    expect(result.missing).toBe(true);
    expect(result.unavailable).toBe(false);
  });

  it("does not mark a Chess.com 403 as missing", async () => {
    const result = await fetchChessComStats("wealth", request(403, null));
    expect(result.missing).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("does not mark a Chess.com 429 or a network failure as missing", async () => {
    const limited = await fetchChessComStats("wealth", request(429, null));
    const offline = await fetchChessComStats("wealth", request(null, null));

    expect(limited.missing).toBe(false);
    expect(limited.unavailable).toBe(true);
    expect(offline.missing).toBe(false);
    expect(offline.unavailable).toBe(true);
  });

  it("treats an error payload served with HTTP 200 as unavailable", async () => {
    const result = await fetchChessComStats(
      "wealth",
      request(200, { code: 0, message: "An internal error has occurred." }),
    );

    expect(result.missing).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("marks a Lichess 404 as missing", async () => {
    const result = await fetchLichessStats(
      "ghost",
      request(404, null, '{"error":"Not found"}'),
    );
    expect(result.missing).toBe(true);
    expect(result.unavailable).toBe(false);
  });

  it("does not mark a Lichess 500 as missing", async () => {
    const result = await fetchLichessStats("wealth", request(500, null));
    expect(result.missing).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("keeps real stats and reports the account as present", async () => {
    const result = await fetchLichessStats(
      "wealth",
      request(200, {
        perfs: {
          rapid: { rating: 1500, games: 40 },
          blitz: { rating: 1400, games: 10 },
        },
      }),
    );

    expect(result.missing).toBe(false);
    expect(result.unavailable).toBe(false);
    expect(result.ratings.rapid).toBe(1500);
    expect(result.gamesPlayed.rapid).toBe(40);
  });
});
