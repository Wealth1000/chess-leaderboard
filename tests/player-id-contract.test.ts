import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { normalizePlayerId } from "@/lib/identity";

/**
 * The tag→id rule exists twice: `lib/identity.ts` for the site and
 * `scripts/add-player.js` for the dispatch action. This is the contract test
 * that keeps the copy honest — it compares the two implementations directly
 * rather than restating the expected output.
 */
const require = createRequire(import.meta.url);
const script = require("../scripts/add-player.js") as {
  normalizePlayerId: (raw: string) => string;
};

const TAGS = [
  "",
  "   ",
  "wealth",
  "Wealth",
  "DA_KVNG",
  "Kwesi Boateng",
  "  T!m-_-B  ",
  "Kwèsí",
  "Àmà",
  "🔥🔥🔥",
  "🔥wealth🔥",
  "player__wizzz",
  "b_abudey123",
  "a.b/c",
  "Ünïcødé Tag",
];

describe("normalizePlayerId contract", () => {
  it.each(TAGS)("agrees with the action on %j", (tag) => {
    expect(script.normalizePlayerId(tag)).toBe(normalizePlayerId(tag));
  });

  it("returns a string for values that are not strings", () => {
    expect(script.normalizePlayerId(undefined as unknown as string)).toBe("");
    expect(script.normalizePlayerId(null as unknown as string)).toBe("");
  });
});
