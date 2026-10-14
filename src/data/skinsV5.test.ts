import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseCompanionSkin } from "../companions/CompanionRules";
import { sheepAnimationForState } from "../entities/SheepAnimation";
import { STORAGE } from "../game/Constants";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { SaveSystem, type SaveData } from "../systems/SaveSystem";
import { SHEEP_SKINS, isSkinId, sheepTextureKey, skinDefinition, type SkinId } from "./sheepSkins";
import { SKIN_ANIMATION_FRAMES, SKIN_NAMES, SKIN_SHEET_URLS } from "./skinSpriteAssets";

const NEW_SKINS = [
  { id: "bee-v1", label: "蜜蜂羊", type: "star-purchase", amount: 60 },
  { id: "mushroom-v1", label: "蘑菇羊", type: "star-purchase", amount: 80 },
  { id: "chef-v1", label: "厨师羊", type: "coins", amount: 100 },
  { id: "pirate-v1", label: "海盗羊", type: "coins", amount: 120 },
  { id: "fox-v1", label: "狐狸羊", type: "star-purchase", amount: 100 },
  { id: "dinosaur-v1", label: "恐龙羊", type: "coins", amount: 160 },
] as const;

// The existing catalog is an append-only compatibility contract for old saves,
// prices, order, and production sheet paths.
const OLD_SKINS = [
  ["white", "default", 0, 1], ["black", "stars", 10, 1], ["brown", "stars", 30, 1],
  ["golden", "coins", 40, 1], ["farmer", "coins", 90, 1],
  ["mint", "coins", 20, 1], ["rose", "coins", 25, 1], ["blueberry", "coins", 35, 1],
  ["lavender", "coins", 45, 1], ["pumpkin", "coins", 50, 1], ["forest", "coins", 60, 1],
  ["chestnut", "coins", 70, 1], ["sunset", "coins", 80, 1],
  ["sleepy-blue", "coins", 80, 2], ["sleepy-cream", "coins", 80, 2],
  ["sleepy-pink", "coins", 80, 2], ["sleepy-mint", "coins", 80, 2], ["dream", "coins", 100, 2],
  ["peach", "coins", 80, 3], ["milktea", "coins", 80, 3], ["cloud", "coins", 80, 3], ["bearcap", "coins", 80, 3],
  ["strawberry-v1", "star-purchase", 40, 4], ["lemon-v1", "star-purchase", 70, 4],
  ["sailor-v1", "star-purchase", 100, 4], ["starlight-v1", "star-purchase", 150, 4],
  ["postman-v1", "coins", 60, 4], ["raincoat-v1", "coins", 90, 4],
  ["explorer-v1", "coins", 120, 4], ["astronaut-v1", "coins", 160, 4],
] as const;

const PRE_EXISTING_SAVE: SaveData = {
  version: 5,
  highScore: 357,
  totalStars: 500,
  spentStars: 75,
  coins: 240,
  selectedSkin: "astronaut-v1",
  unlockedSkins: ["white", "black", "brown", "strawberry-v1", "astronaut-v1"],
  upgrades: { jump: 2, speed: 1, magnet: 3, dash: 0 },
  settings: { music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 },
};

function installSave(overrides: Partial<SaveData> = {}): Map<string, string> {
  const values = new Map<string, string>([[STORAGE.saveKey, JSON.stringify({ ...PRE_EXISTING_SAVE, ...overrides })]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  });
  return values;
}

afterEach(() => vi.unstubAllGlobals());

describe("six v5 cosmetic catalog additions", () => {
  it("preserves all 30 prior entries and completes the 36-skin name and sheet catalogs", () => {
    expect(SHEEP_SKINS).toHaveLength(36);
    const ids = SHEEP_SKINS.map(skin => skin.id);
    expect(ids).toEqual([...OLD_SKINS.map(([id]) => id), ...NEW_SKINS.map(skin => skin.id)]);
    expect(new Set(ids).size).toBe(36);
    expect(Object.keys(SKIN_NAMES)).toEqual(ids);
    expect(Object.keys(SKIN_SHEET_URLS)).toEqual(ids);
    expect(SHEEP_SKINS.slice(0, 30).map(({ id, unlock }) => [id, unlock.type, unlock.amount]))
      .toEqual(OLD_SKINS.map(([id, type, amount]) => [id, type, amount]));
    for (const [id, , , version] of OLD_SKINS) {
      expect(SKIN_SHEET_URLS[id]).toContain(`runtime-v${version}/${id}-sheet.png`);
    }
  });

  it.each(NEW_SKINS)("registers $id with its approved single-currency price and cosmetic fields", ({ id, label, type, amount }) => {
    expect(isSkinId(id)).toBe(true);
    const skin = skinDefinition(id)!;
    expect(skin.label).toBe(label);
    expect(skin.unlock).toEqual({ type, amount });
    expect(SKIN_NAMES[id]).toBe(label);
    expect(SKIN_SHEET_URLS[id]).toContain(`runtime-v5/${id}-sheet.png`);
    expect(sheepTextureKey(id)).toBe(`sheep-runner-${id}`);
    expect(Object.keys(skin).sort()).toEqual(["id", "label", "palette", "unlock"]);
  });

  it("retains the established 15-frame animation map", () => {
    expect(SKIN_ANIMATION_FRAMES).toEqual({
      idle: [0, 10], run: [1, 2, 3, 4, 11, 12], jump: [5], fall: [6],
      hit: [7], dash: [8, 13], dead: [9, 14],
    });
    expect(new Set(Object.values(SKIN_ANIMATION_FRAMES).flat()).size).toBe(15);
  });

  it.each(NEW_SKINS)("uses existing animation and unlocked companion APIs for $id", ({ id }) => {
    expect(sheepAnimationForState("RUNNING", id)).toBe(`sheep-${id}-run`);
    expect(sheepAnimationForState("JUMPING", id)).toBe(`sheep-${id}-jump`);
    expect(sheepAnimationForState("HIT", id)).toBe(`sheep-${id}-hit`);
    expect(sheepAnimationForState("DASH", id)).toBe(`sheep-${id}-dash`);
    expect(sheepAnimationForState("DEAD", id)).toBe(`sheep-${id}-dead`);
    expect(chooseCompanionSkin(["white", id, id, "future-invalid"], "white", () => 0)).toBe(id);
    expect(chooseCompanionSkin(["white", id], id, () => 0)).toBe("white");
    expect(chooseCompanionSkin(["white"], "white", () => 0)).toBe("white");
  });
});

describe("v5 cosmetics use existing purchase, equip, and save transactions", () => {
  it.each(NEW_SKINS)("rejects insufficient funds and locked equip for $id without changing an old save", ({ id, type, amount }) => {
    const values = installSave(type === "coins"
      ? { coins: amount - 1 }
      : { totalStars: 500, spentStars: 500 - amount + 1 });
    const before = values.get(STORAGE.saveKey);
    const progression = new ProgressionSystem();
    expect(progression.equipSkin(id)).toEqual({ status: "locked", skinId: id });
    expect(progression.unlockSkin(id)).toMatchObject({
      status: type === "coins" ? "insufficient-coins" : "insufficient-stars",
      skinId: id, required: amount, available: amount - 1,
    });
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(NEW_SKINS)("charges $id once, persists equip, and preserves progress, settings, and gameplay effects", ({ id, type, amount }) => {
    const values = installSave(type === "coins"
      ? { coins: amount + 9 }
      : { totalStars: 500, spentStars: 500 - amount - 7 });
    const before = SaveSystem.load();
    const effects = ProgressionSystem.currentEffects();
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin(id)).toMatchObject({ status: "unlocked", skinId: id, cost: amount });
    const bought = SaveSystem.load();
    expect(bought).toEqual({
      ...before,
      coins: type === "coins" ? 9 : before.coins,
      spentStars: type === "star-purchase" ? before.spentStars + amount : before.spentStars,
      unlockedSkins: [...before.unlockedSkins, id],
    });
    if (type === "star-purchase") expect(SaveSystem.availableStars(bought)).toBe(7);
    const afterPurchase = values.get(STORAGE.saveKey);
    expect(progression.unlockSkin(id)).toMatchObject({ status: "already-unlocked", skinId: id, cost: 0 });
    expect(values.get(STORAGE.saveKey)).toBe(afterPurchase);
    expect(progression.equipSkin(id)).toEqual({ status: "equipped", skinId: id });
    expect(SaveSystem.loadForTransaction()).toEqual({ ...bought, selectedSkin: id });
    expect(ProgressionSystem.currentRun()).toEqual({ skinId: id, effects });
  });

  it.each(NEW_SKINS)("keeps persisted balances and ownership unchanged when the $id purchase write fails", ({ id }) => {
    const values = installSave();
    const before = values.get(STORAGE.saveKey);
    vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error("storage full"); });
    expect(new ProgressionSystem().unlockSkin(id)).toMatchObject({ status: "storage-error", skinId: id });
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(SaveSystem.load()).toEqual(PRE_EXISTING_SAVE);
  });

  it("loads a saved 36-skin collection without changing old fields or the save schema", () => {
    const collection = SHEEP_SKINS.map(skin => skin.id);
    const stored: SaveData = { ...PRE_EXISTING_SAVE, unlockedSkins: collection, selectedSkin: "dinosaur-v1" };
    const values = installSave(stored);
    const before = values.get(STORAGE.saveKey);
    expect(SaveSystem.loadForTransaction()).toEqual(stored);
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    for (const id of collection as SkinId[]) expect(new ProgressionSystem().equipSkin(id).status).toBe("equipped");
    expect(SaveSystem.load()).toEqual(stored);
  });

  it("migrates the prior v4 schema with all 30 original skins and settings intact", () => {
    const unlockedSkins = OLD_SKINS.map(([id]) => id);
    const legacy = { ...PRE_EXISTING_SAVE, version: 4, unlockedSkins };
    const values = installSave();
    values.set(STORAGE.saveKey, JSON.stringify(legacy));
    const migrated = { ...PRE_EXISTING_SAVE, spentStars: 0, unlockedSkins };
    expect(SaveSystem.loadForTransaction()).toEqual(migrated);
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toEqual(migrated);
  });
});
