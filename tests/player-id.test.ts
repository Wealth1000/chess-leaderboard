import { describe, expect, it } from "vitest";
import { normalizePlayerId } from "@/lib/identity";

describe("normalizePlayerId", () => {
  it("lowercases and keeps simple tags untouched", () => {
    expect(normalizePlayerId("wealth")).toBe("wealth");
    expect(normalizePlayerId("Wealth")).toBe("wealth");
    expect(normalizePlayerId("DA_KVNG")).toBe("da_kvng");
    expect(normalizePlayerId("b_abudey123")).toBe("b_abudey123");
  });

  it("folds spaces and punctuation into single underscores", () => {
    expect(normalizePlayerId("Kwesi Boateng")).toBe("kwesi_boateng");
    expect(normalizePlayerId("  T!m-_-B  ")).toBe("t_m_b");
    expect(normalizePlayerId("player__wizzz")).toBe("player_wizzz");
    expect(normalizePlayerId("a.b/c")).toBe("a_b_c");
  });

  it("strips diacritics instead of turning them into underscores", () => {
    expect(normalizePlayerId("Kwèsí")).toBe("kwesi");
    expect(normalizePlayerId("Àmà")).toBe("ama");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizePlayerId("  Wealth!  ")).toBe("wealth");
    expect(normalizePlayerId("🔥wealth🔥")).toBe("wealth");
    expect(normalizePlayerId("_beeba_")).toBe("beeba");
  });

  it("returns an empty id when nothing usable remains", () => {
    expect(normalizePlayerId("")).toBe("");
    expect(normalizePlayerId("   ")).toBe("");
    expect(normalizePlayerId("🔥🔥")).toBe("");
    expect(normalizePlayerId("!@#$%^&*()")).toBe("");
  });

  it("is idempotent", () => {
    for (const tag of ["Kwesi Boateng", "DA_KVNG", "🔥wealth🔥", "a.b/c"]) {
      const once = normalizePlayerId(tag);
      expect(normalizePlayerId(once)).toBe(once);
    }
  });

  it("only ever emits [a-z0-9_]", () => {
    for (const tag of ["Kwèsí Boateng", "T!m¤th¥", "DA_KVNG", "🔥🔥🔥"]) {
      expect(normalizePlayerId(tag)).toMatch(/^[a-z0-9_]*$/);
    }
  });
});
