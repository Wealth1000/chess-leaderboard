import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { Player } from "@/lib/types";

/**
 * The join workflow runs `scripts/add-player.js` under plain Node, so the
 * server-side rules are a CommonJS mirror of lib/join.ts. These tests pin the
 * behaviour that the action relies on: nothing is written unless every check
 * passes, and a failure stops the run.
 */
const require = createRequire(import.meta.url);

type Check =
  | { status: "ok"; username: string }
  | { status: "missing" }
  | { status: "unverified"; detail?: string };

type BuildPlayer = (
  submission: {
    whatsappTag?: string;
    name?: string;
    chessCom?: string;
    lichess?: string;
  },
  players: Player[],
  resolve?: (platform: "chess.com" | "lichess", username: string) => Promise<Check>,
) => Promise<
  | { ok: true; player: Player }
  | { ok: false; errors: Array<{ field: string; message: string }> }
>;

const { buildPlayer, DUPLICATE_MESSAGE } = require(
  "../scripts/add-player.js",
) as { buildPlayer: BuildPlayer; DUPLICATE_MESSAGE: string };

function resolver(checks: Record<string, Check>) {
  const calls: Array<[string, string]> = [];

  const resolve = async (platform: "chess.com" | "lichess", username: string) => {
    calls.push([platform, username]);
    return checks[`${platform}:${username.toLowerCase()}`] ?? { status: "missing" };
  };

  return { resolve, calls };
}

const EXISTING: Player[] = [
  { id: "wealth", name: "Wealth", chessCom: "Wealth98981" },
];

describe("add-player buildPlayer", () => {
  it("builds a player from canonical API usernames", async () => {
    const { resolve } = resolver({
      "lichess:fifi_enko": { status: "ok", username: "Fifi_Enko" },
    });

    const result = await buildPlayer(
      { whatsappTag: "Fifi Enko", lichess: "fifi_enko" },
      EXISTING,
      resolve,
    );

    expect(result).toEqual({
      ok: true,
      player: { id: "fifi_enko", name: "Fifi Enko", lichess: "Fifi_Enko" },
    });
  });

  it("rejects a duplicate tag", async () => {
    const { resolve } = resolver({});
    const result = await buildPlayer(
      { whatsappTag: "WEALTH!", lichess: "someone" },
      EXISTING,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "whatsappTag",
      message: DUPLICATE_MESSAGE,
    });
  });

  it("rejects a handle already on the board", async () => {
    const { resolve } = resolver({
      "chess.com:wealth98981": { status: "ok", username: "Wealth98981" },
    });

    const result = await buildPlayer(
      { whatsappTag: "New Member", chessCom: "wealth98981" },
      EXISTING,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "chessCom",
      message: DUPLICATE_MESSAGE,
    });
  });

  it("rejects a submission with no handles", async () => {
    const { resolve, calls } = resolver({});
    const result = await buildPlayer(
      { whatsappTag: "New Member" },
      EXISTING,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "form",
      message: "At least one of CHESS_COM or LICHESS is required.",
    });
    expect(calls).toEqual([]);
  });

  it("reports a 404 as a missing account", async () => {
    const { resolve } = resolver({});
    const result = await buildPlayer(
      { whatsappTag: "New Member", chessCom: "ghost" },
      EXISTING,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "chessCom",
      message: "No Chess.com account with that username.",
    });
  });

  it("carries the failure detail when verification itself failed", async () => {
    const { resolve } = resolver({
      "lichess:newmember": { status: "unverified", detail: "HTTP 429" },
    });

    const result = await buildPlayer(
      { whatsappTag: "New Member", lichess: "newmember" },
      EXISTING,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "lichess",
      message: "Could not verify Lichess (HTTP 429).",
    });
  });
});
