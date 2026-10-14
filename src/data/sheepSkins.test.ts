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

  it("appends the eight approved single-currency purchases without ability fields", () => {
    expect(SHEEP_SKINS.slice(22, 30).map(({ id, label, unlock }) => ({ id, label, unlock }))).toEqual([
      { id: "strawberry-v1", label: "草莓羊", unlock: { type: "star-purchase", amount: 40 } },
      { id: "lemon-v1", label: "柠檬羊", unlock: { type: "star-purchase", amount: 70 } },
      { id: "sailor-v1", label: "水手羊", unlock: { type: "star-purchase", amount: 100 } },
      { id: "starlight-v1", label: "星灯羊", unlock: { type: "star-purchase", amount: 150 } },
      { id: "postman-v1", label: "邮差羊", unlock: { type: "coins", amount: 60 } },
      { id: "raincoat-v1", label: "雨衣羊", unlock: { type: "coins", amount: 90 } },
      { id: "explorer-v1", label: "探险羊", unlock: { type: "coins", amount: 120 } },
      { id: "astronaut-v1", label: "航天羊", unlock: { type: "coins", amount: 160 } },
    ]);
    for (const skin of SHEEP_SKINS.slice(22)) {
      expect(Object.keys(skin).sort()).toEqual(["id", "label", "palette", "unlock"]);
      expect(skinDefinition(skin.id)).toBe(skin);
    }
  });

  it("retains all existing themed skin prices and order", () => {
    expect(SHEEP_SKINS.slice(13, 22).map(({ id, unlock }) => [id, unlock.type, unlock.amount])).toEqual([
      ["sleepy-blue", "coins", 80], ["sleepy-cream", "coins", 80],
      ["sleepy-pink", "coins", 80], ["sleepy-mint", "coins", 80], ["dream", "coins", 100],
      ["peach", "coins", 80], ["milktea", "coins", 80], ["cloud", "coins", 80], ["bearcap", "coins", 80],
    ]);
  });
});
