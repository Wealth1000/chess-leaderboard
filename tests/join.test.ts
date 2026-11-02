import { describe, expect, it } from "vitest";
import {
  DUPLICATE_MESSAGE,
  HANDLE_REQUIRED_MESSAGE,
  TAG_REQUIRED_MESSAGE,
  validateSubmission,
  type HandleCheck,
  type HandleResolver,
  type Submission,
} from "@/lib/join";
import type { Platform, Player } from "@/lib/types";

const PLAYERS: Player[] = [
  { id: "wealth", name: "Wealth", chessCom: "Wealth98981", lichess: "Wealth" },
];

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    whatsappTag: "Fifi Enko",
    name: "",
    chessCom: "",
    lichess: "fifi_enko",
    ...overrides,
  };
}

function resolver(checks: Record<string, HandleCheck>) {
  const calls: Array<[Platform, string]> = [];

  const resolve: HandleResolver = async (platform, username) => {
    calls.push([platform, username]);
    return checks[`${platform}:${username.toLowerCase()}`] ?? { status: "missing" };
  };

  return { resolve, calls };
}

describe("validateSubmission", () => {
  it("accepts a Lichess-only member with the API's canonical casing", async () => {
    const { resolve } = resolver({
      "lichess:fifi_enko": {
        status: "ok",
        username: "Fifi_Enko",
        rating: 1724,
      },
    });

    const result = await validateSubmission(submission(), PLAYERS, resolve);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.player).toEqual({
      id: "fifi_enko",
      name: "Fifi Enko",
      lichess: "Fifi_Enko",
    });
    expect(result.checks.lichess).toEqual({
      status: "ok",
      username: "Fifi_Enko",
      rating: 1724,
    });
    expect(result.checks["chess.com"]).toBeNull();
  });

  it("honours a display name that differs from the tag", async () => {
    const { resolve } = resolver({
      "chess.com:newmember": {
        status: "ok",
        username: "NewMember",
        rating: 1300,
      },
    });

    const result = await validateSubmission(
      submission({ name: "  Wealth  ", chessCom: "newmember", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player).toEqual({
      id: "fifi_enko",
      name: "Wealth",
      chessCom: "NewMember",
    });
  });

  it("accepts both handles and stores both canonical usernames", async () => {
    const { resolve } = resolver({
      "chess.com:wealth98981": {
        status: "ok",
        username: "Wealth98981",
        rating: 1300,
      },
      "lichess:wealth": { status: "ok", username: "Wealth", rating: 1510 },
    });

    const result = await validateSubmission(
      submission({ chessCom: "wealth98981", lichess: "wealth" }),
      [],
      resolve,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player.chessCom).toBe("Wealth98981");
    expect(result.player.lichess).toBe("Wealth");
  });

  it("rejects an empty tag without calling the APIs", async () => {
    const { resolve, calls } = resolver({});
    const result = await validateSubmission(
      submission({ whatsappTag: "🔥", chessCom: "", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "whatsappTag",
      message: TAG_REQUIRED_MESSAGE,
    });
    expect(calls).toEqual([]);
  });

  it("rejects a tag that is already on the board, after normalization", async () => {
    const { resolve } = resolver({});
    const result = await validateSubmission(
      submission({ whatsappTag: "  WEALTH!  ", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "whatsappTag",
      message: DUPLICATE_MESSAGE,
    });
  });

  it("requires at least one handle and does not call the APIs", async () => {
    const { resolve, calls } = resolver({});
    const result = await validateSubmission(
      submission({ chessCom: "   ", lichess: "  " }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "form",
      message: HANDLE_REQUIRED_MESSAGE,
    });
    expect(calls).toEqual([]);
  });

  it("treats a 404 as 'no such account'", async () => {
    const { resolve } = resolver({ "chess.com:nobody": { status: "missing" } });
    const result = await validateSubmission(
      submission({ chessCom: "nobody", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "chessCom",
      message: "No Chess.com account with that username.",
    });
  });

  it("treats any other failure as 'could not verify', never as missing", async () => {
    const { resolve } = resolver({
      "chess.com:wealth98981": { status: "unverified" },
    });
    const result = await validateSubmission(
      submission({ chessCom: "wealth98981", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "chessCom",
      message: "Couldn't verify that account right now — try again.",
    });
    expect(
      result.errors.some((error) => error.message.includes("No Chess.com")),
    ).toBe(false);
  });

  it("refuses a handle already on the board, regardless of casing", async () => {
    const { resolve } = resolver({
      "chess.com:wealth98981": {
        status: "ok",
        username: "Wealth98981",
        rating: 1300,
      },
    });

    const result = await validateSubmission(
      submission({ whatsappTag: "New Member", chessCom: "WEALTH98981", lichess: "" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      field: "chessCom",
      message: DUPLICATE_MESSAGE,
    });
  });

  it("only resolves the handles that were typed", async () => {
    const { resolve, calls } = resolver({
      "lichess:fifi_enko": {
        status: "ok",
        username: "Fifi_Enko",
        rating: 1724,
      },
    });

    await validateSubmission(submission(), PLAYERS, resolve);

    expect(calls).toEqual([["lichess", "fifi_enko"]]);
  });

  it("reports every problem in one pass", async () => {
    const { resolve } = resolver({
      "chess.com:ghost": { status: "missing" },
      "lichess:ghost": { status: "missing" },
    });

    const result = await validateSubmission(
      submission({ whatsappTag: "", chessCom: "ghost", lichess: "ghost" }),
      PLAYERS,
      resolve,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.field)).toEqual([
      "whatsappTag",
      "chessCom",
      "lichess",
    ]);
  });
});
