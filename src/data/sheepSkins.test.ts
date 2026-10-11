import { describe, expect, it } from "vitest";
import { SHEEP_SKINS, skinDefinition, isSkinId } from "./sheepSkins";

describe("sheep skin catalog", () => {
  it("defines the approved default, star, and coin unlock requirements", () => {
    expect(SHEEP_SKINS.slice(0, 5).map(({ id, unlock }) => ({ id, unlock }))).toEqual([
      { id: "white", unlock: { type: "default", amount: 0 } },
      { id: "black", unlock: { type: "stars", amount: 10 } },
      { id: "brown", unlock: { type: "stars", amount: 30 } },
      { id: "golden", unlock: { type: "coins", amount: 40 } },
      { id: "farmer", unlock: { type: "coins", amount: 90 } },
    ]);
  });

  it("adds eight cosmetic coin skins without changing the original prices", () => {
    expect(SHEEP_SKINS.slice(5, 13).map(({ id, unlock }) => ({ id, unlock }))).toEqual([
      { id: "mint", unlock: { type: "coins", amount: 20 } },
      { id: "rose", unlock: { type: "coins", amount: 25 } },
      { id: "blueberry", unlock: { type: "coins", amount: 35 } },
      { id: "lavender", unlock: { type: "coins", amount: 45 } },
      { id: "pumpkin", unlock: { type: "coins", amount: 50 } },
      { id: "forest", unlock: { type: "coins", amount: 60 } },
      { id: "chestnut", unlock: { type: "coins", amount: 70 } },
      { id: "sunset", unlock: { type: "coins", amount: 80 } },
    ]);
    expect(new Set(SHEEP_SKINS.map(({ id }) => id)).size).toBe(SHEEP_SKINS.length);
  });

  it("provides a palette for every valid skin id and rejects unknown ids", () => {
    for (const skin of SHEEP_SKINS) {
      expect(isSkinId(skin.id)).toBe(true);
      expect(skinDefinition(skin.id)?.palette).toEqual(expect.objectContaining({ wool: expect.any(String), woolShade: expect.any(String), face: expect.any(String) }));
    }
    expect(isSkinId("rainbow")).toBe(false);
    expect(skinDefinition("rainbow")).toBeNull();
  });
});
