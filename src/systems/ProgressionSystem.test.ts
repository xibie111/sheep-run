import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../game/Constants";
import { ProgressionSystem } from "./ProgressionSystem";
import { SaveSystem, type SaveData } from "./SaveSystem";

const EMPTY_SAVE: SaveData = {
  version: 5,
  highScore: 0,
  totalStars: 0,
  spentStars: 0,
  coins: 0,
  selectedSkin: "white",
  unlockedSkins: ["white"],
  upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 },
  settings: { music: true, sfx: true, musicVolume: 1, sfxVolume: 1 },
};

function installSave(overrides: Partial<SaveData> = {}): Map<string, string> {
  const values = new Map<string, string>([[STORAGE.saveKey, JSON.stringify({ ...EMPTY_SAVE, ...overrides })]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  });
  return values;
}

describe("ProgressionSystem upgrade transactions", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("returns the approved next-level cost schedule", () => {
    installSave();
    const getCost = (ProgressionSystem as unknown as { upgradeCost?: (level: number) => number | null }).upgradeCost;
    expect(typeof getCost).toBe("function");
    if (!getCost) return;
    expect([0, 1, 2, 3, 4, 5].map(getCost)).toEqual([3, 5, 8, 12, 18, null]);
  });

  it("deducts the next-level cost and persists the purchased level", () => {
    const values = installSave({ coins: 11 });
    const progression = new ProgressionSystem() as unknown as {
      purchaseUpgrade?: (upgrade: "jump" | "speed" | "magnet" | "dash") => unknown;
    };
    expect(typeof progression.purchaseUpgrade).toBe("function");
    if (!progression.purchaseUpgrade) return;

    const result = progression.purchaseUpgrade("jump");

    expect(result).toEqual({ status: "purchased", upgrade: "jump", level: 1, cost: 3, coinBalance: 8 });
    expect(JSON.parse(values.get(STORAGE.saveKey)!).upgrades.jump).toBe(1);
    expect(JSON.parse(values.get(STORAGE.saveKey)!).coins).toBe(8);
  });

  it("leaves save data unchanged when coins are insufficient or the upgrade is capped", () => {
    const values = installSave({ coins: 2 });
    const progression = new ProgressionSystem() as unknown as {
      purchaseUpgrade?: (upgrade: "jump" | "speed" | "magnet" | "dash") => unknown;
    };
    expect(typeof progression.purchaseUpgrade).toBe("function");
    if (!progression.purchaseUpgrade) return;

    expect(progression.purchaseUpgrade("jump")).toEqual({
      status: "insufficient-coins", upgrade: "jump", level: 0, cost: 3, coinBalance: 2,
    });
    expect(JSON.parse(values.get(STORAGE.saveKey)!).upgrades.jump).toBe(0);
    expect(JSON.parse(values.get(STORAGE.saveKey)!).coins).toBe(2);

    const capped = installSave({ coins: 100, upgrades: { ...EMPTY_SAVE.upgrades, jump: 5 } });
    expect(progression.purchaseUpgrade("jump")).toEqual({
      status: "max-level", upgrade: "jump", level: 5, cost: 0, coinBalance: 100,
    });
    expect(JSON.parse(capped.get(STORAGE.saveKey)!).upgrades.jump).toBe(5);
    expect(JSON.parse(capped.get(STORAGE.saveKey)!).coins).toBe(100);
  });

  it("rejects Dash purchases without changing stored coins or level", () => {
    const values = installSave({ coins: 12, upgrades: { ...EMPTY_SAVE.upgrades, dash: 2 } });
    const before = values.get(STORAGE.saveKey);
    const progression = new ProgressionSystem();

    expect(progression.purchaseUpgrade("dash")).toEqual({
      status: "disabled", upgrade: "dash", level: 2, cost: 0, coinBalance: 12,
    });
    expect(values.get(STORAGE.saveKey)).toBe(before);
  });

  it("loads persisted upgrade levels into the current effect set", () => {
    installSave({ upgrades: { ...EMPTY_SAVE.upgrades, jump: 2, speed: 2, magnet: 3, dash: 5 } });
    const loadEffects = (ProgressionSystem as unknown as { currentEffects?: () => unknown }).currentEffects;
    expect(typeof loadEffects).toBe("function");
    if (!loadEffects) return;

    expect(loadEffects.call(ProgressionSystem)).toEqual({
      jumpImpulseMultiplier: 1.06,
      worldSpeedMultiplier: 1.04,
      magnetRadiusPx: 146,
      dashInvulnerabilityMs: 280,
    });
  });

  it("loads selected skin together with saved upgrade effects for a run", () => {
    installSave({ selectedSkin: "black", unlockedSkins: ["white", "black"], upgrades: { ...EMPTY_SAVE.upgrades, speed: 1 } });
    expect(ProgressionSystem.currentRun()).toEqual({
      skinId: "black",
      effects: { jumpImpulseMultiplier: 1, worldSpeedMultiplier: 1.02, magnetRadiusPx: 110, dashInvulnerabilityMs: 280 },
    });
  });

  it("unlocks star skins at their lifetime-star threshold without spending coins", () => {
    const progression = new ProgressionSystem();
    installSave({ totalStars: 9, coins: 7 });
    expect(progression.unlockSkin("black")).toEqual({
      status: "insufficient-stars", skinId: "black", required: 10, available: 9, coinBalance: 7,
    });

    const values = installSave({ totalStars: 30, coins: 7 });
    expect(progression.unlockSkin("brown")).toEqual({
      status: "unlocked", skinId: "brown", cost: 0, coinBalance: 7,
    });
    expect(JSON.parse(values.get(STORAGE.saveKey)!).unlockedSkins).toEqual(["white", "brown"]);
    expect(JSON.parse(values.get(STORAGE.saveKey)!).coins).toBe(7);
  });

  it("purchases coin skins atomically and rejects insufficient balances", () => {
    const progression = new ProgressionSystem();
    const insufficient = installSave({ coins: 89 });
    const before = insufficient.get(STORAGE.saveKey);
    expect(progression.unlockSkin("farmer")).toEqual({
      status: "insufficient-coins", skinId: "farmer", required: 90, available: 89,
    });
    expect(insufficient.get(STORAGE.saveKey)).toBe(before);

    const values = installSave({ coins: 40 });
    expect(progression.unlockSkin("golden")).toEqual({
      status: "unlocked", skinId: "golden", cost: 40, coinBalance: 0,
    });
    expect(JSON.parse(values.get(STORAGE.saveKey)!).coins).toBe(0);
    expect(JSON.parse(values.get(STORAGE.saveKey)!).unlockedSkins).toContain("golden");
  });

  it("persists equip selection only for unlocked skins", () => {
    const progression = new ProgressionSystem();
    const locked = installSave();
    const before = locked.get(STORAGE.saveKey);
    expect(progression.equipSkin("farmer")).toEqual({ status: "locked", skinId: "farmer" });
    expect(locked.get(STORAGE.saveKey)).toBe(before);

    const values = installSave({ unlockedSkins: ["white", "black"] });
    expect(progression.equipSkin("black")).toEqual({ status: "equipped", skinId: "black" });
    expect(JSON.parse(values.get(STORAGE.saveKey)!).selectedSkin).toBe("black");
  });

  it("maps upgrade levels to the approved gameplay effects", () => {
    const effectsFor = (ProgressionSystem as unknown as {
      effectsFor?: (levels: SaveData["upgrades"]) => unknown;
    }).effectsFor;
    expect(typeof effectsFor).toBe("function");
    if (!effectsFor) return;

    expect(effectsFor({ jump: 1, speed: 2, magnet: 3, dash: 4 })).toEqual({
      jumpImpulseMultiplier: 1.03,
      worldSpeedMultiplier: 1.04,
      magnetRadiusPx: 146,
      dashInvulnerabilityMs: 280,
    });
    expect(effectsFor({ jump: 5, speed: 5, magnet: 5, dash: 5 })).toEqual({
      jumpImpulseMultiplier: 1.15,
      worldSpeedMultiplier: 1.1,
      magnetRadiusPx: 170,
      dashInvulnerabilityMs: 280,
    });
  });

  it("reports write failures without charging, unlocking, equipping or upgrading", () => {
    const values = installSave({ coins: 100, totalStars: 30, unlockedSkins: ["white", "black"] });
    const before = values.get(STORAGE.saveKey);
    const write = vi.mocked(window.localStorage.setItem);
    write.mockImplementation(() => { throw new Error("storage full"); });
    const progression = new ProgressionSystem();

    expect(progression.unlockSkin("farmer")).toMatchObject({ status: "storage-error", coinBalance: 100 });
    expect(progression.unlockSkin("brown")).toMatchObject({ status: "storage-error" });
    expect(progression.equipSkin("black")).toEqual({ status: "storage-error", skinId: "black" });
    expect(progression.purchaseUpgrade("jump")).toMatchObject({ status: "storage-error", level: 0, coinBalance: 100 });
    expect(progression.awardRun(500)).toEqual({ coinsEarned: 20, coinBalance: 100, saveFailed: true });
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(SaveSystem.load()).toMatchObject({ coins: 100, selectedSkin: "white", unlockedSkins: ["white", "black"] });

    write.mockImplementation((key: string, value: string) => values.set(key, value));
    expect(progression.unlockSkin("farmer")).toMatchObject({ status: "unlocked", coinBalance: 10 });
    expect(progression.unlockSkin("farmer")).toMatchObject({ status: "already-unlocked", coinBalance: 10 });
    expect(progression.equipSkin("farmer")).toMatchObject({ status: "equipped" });
    expect(SaveSystem.load()).toMatchObject({ coins: 10, selectedSkin: "farmer" });
  });

  it("rejects transactions when reading fails without overwriting an existing save", () => {
    const values = installSave({ coins: 100, unlockedSkins: ["white", "black"], selectedSkin: "black" });
    const before = values.get(STORAGE.saveKey);
    vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new Error("read blocked"); });
    const progression = new ProgressionSystem();

    expect(progression.unlockSkin("farmer").status).toBe("storage-error");
    expect(progression.equipSkin("white").status).toBe("storage-error");
    expect(progression.purchaseUpgrade("jump").status).toBe("storage-error");
    expect(progression.awardRun(500).saveFailed).toBe(true);
    SaveSystem.recordTotalStars();
    SaveSystem.recordHighScore(500);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    expect(values.get(STORAGE.saveKey)).toBe(before);
  });

  it.each([
    ["strawberry-v1", 40], ["lemon-v1", 70], ["sailor-v1", 100], ["starlight-v1", 150],
  ] as const)("purchases %s with exactly its available star price in one atomic write", (skinId, cost) => {
    const values = installSave({ totalStars: cost + 30, spentStars: 30, coins: 77 });
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin(skinId)).toEqual({ status: "unlocked", skinId, cost, coinBalance: 77, starBalance: 0 });
    const saved = JSON.parse(values.get(STORAGE.saveKey)!);
    expect(saved).toMatchObject({ version: 5, totalStars: cost + 30, spentStars: cost + 30, coins: 77, selectedSkin: "white" });
    expect(saved.unlockedSkins).toEqual(["white", skinId]);
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(SaveSystem.availableStars(SaveSystem.load())).toBe(0);
  });

  it("refuses star purchases based on available stars rather than lifetime total", () => {
    const values = installSave({ totalStars: 100, spentStars: 61, coins: 99 });
    const before = values.get(STORAGE.saveKey);
    expect(new ProgressionSystem().unlockSkin("strawberry-v1")).toEqual({
      status: "insufficient-stars", skinId: "strawberry-v1", required: 40, available: 39, starBalance: 39, coinBalance: 99,
    });
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("loads current balances for consecutive purchases and repeated rapid taps cannot double-charge", () => {
    const values = installSave({ totalStars: 120, coins: 25 });
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin("strawberry-v1")).toMatchObject({ status: "unlocked", starBalance: 80 });
    for (let tap = 0; tap < 10; tap += 1) expect(progression.unlockSkin("strawberry-v1")).toMatchObject({ status: "already-unlocked", cost: 0 });
    expect(progression.unlockSkin("lemon-v1")).toMatchObject({ status: "unlocked", starBalance: 10 });
    expect(progression.unlockSkin("sailor-v1")).toMatchObject({ status: "insufficient-stars", available: 10 });
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toMatchObject({ totalStars: 120, spentStars: 110, coins: 25, unlockedSkins: ["white", "strawberry-v1", "lemon-v1"] });
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it("reports failed star persistence without fake unlock, charge or automatic equipment", () => {
    const values = installSave({ totalStars: 100, spentStars: 20, coins: 6, selectedSkin: "black", unlockedSkins: ["white", "black"] });
    const before = values.get(STORAGE.saveKey);
    const write = vi.mocked(window.localStorage.setItem);
    write.mockImplementation(() => { throw new Error("full"); });
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin("strawberry-v1")).toEqual({ status: "storage-error", skinId: "strawberry-v1", starBalance: 80, coinBalance: 6 });
    expect(values.get(STORAGE.saveKey)).toBe(before);
    expect(SaveSystem.load()).toMatchObject({ spentStars: 20, selectedSkin: "black", unlockedSkins: ["white", "black"] });
    write.mockImplementation((key, value) => values.set(key, value));
    expect(progression.unlockSkin("strawberry-v1")).toMatchObject({ status: "unlocked", starBalance: 40 });
    expect(SaveSystem.load()).toMatchObject({ spentStars: 60, selectedSkin: "black", unlockedSkins: ["white", "black", "strawberry-v1"] });
  });

  it("can equip an owned star skin after its purchase exhausts the available balance", () => {
    const values = installSave({ totalStars: 40 });
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin("strawberry-v1").status).toBe("unlocked");
    expect(progression.equipSkin("strawberry-v1")).toEqual({ status: "equipped", skinId: "strawberry-v1" });
    expect(SaveSystem.availableStars(SaveSystem.load())).toBe(0);
    expect(ProgressionSystem.currentRun().skinId).toBe("strawberry-v1");
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toMatchObject({ totalStars: 40, spentStars: 40, selectedSkin: "strawberry-v1" });
  });

  it("retains free cumulative thresholds after spending all available stars", () => {
    const values = installSave({ totalStars: 100, spentStars: 100, coins: 3 });
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin("black")).toEqual({ status: "unlocked", skinId: "black", cost: 0, coinBalance: 3 });
    expect(progression.unlockSkin("brown")).toEqual({ status: "unlocked", skinId: "brown", cost: 0, coinBalance: 3 });
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toMatchObject({ totalStars: 100, spentStars: 100, coins: 3, unlockedSkins: ["white", "black", "brown"] });
  });

  it.each([
    ["postman-v1", 60], ["raincoat-v1", 90], ["explorer-v1", 120], ["astronaut-v1", 160],
  ] as const)("purchases %s with coins only and retains spent stars", (skinId, cost) => {
    const values = installSave({ totalStars: 140, spentStars: 110, coins: cost });
    expect(new ProgressionSystem().unlockSkin(skinId)).toEqual({ status: "unlocked", skinId, cost, coinBalance: 0 });
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toMatchObject({ coins: 0, totalStars: 140, spentStars: 110, unlockedSkins: ["white", skinId], selectedSkin: "white" });
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("preserves spent stars when awarding run coins and purchasing existing upgrades", () => {
    installSave({ totalStars: 120, spentStars: 90, coins: 7 });
    const progression = new ProgressionSystem();
    expect(progression.awardRun(250)).toEqual({ coinsEarned: 10, coinBalance: 17 });
    expect(progression.purchaseUpgrade("jump")).toEqual({ status: "purchased", upgrade: "jump", level: 1, cost: 3, coinBalance: 14 });
    expect(SaveSystem.load()).toMatchObject({ totalStars: 120, spentStars: 90, coins: 14, upgrades: { jump: 1, speed: 0, magnet: 0, dash: 0 } });
  });

  it.each([
    "{broken",
    JSON.stringify({ ...EMPTY_SAVE, version: 6, totalStars: 999, coins: 999 }),
    JSON.stringify({ ...EMPTY_SAVE, totalStars: 50, spentStars: 51, coins: 999 }),
    JSON.stringify({ ...EMPTY_SAVE, spentStars: -1, totalStars: 999, coins: 999 }),
  ])("protects unreadable, future or corrupt saves from every transaction: %s", (raw) => {
    const values = installSave();
    values.set(STORAGE.saveKey, raw);
    const progression = new ProgressionSystem();
    expect(progression.unlockSkin("strawberry-v1").status).toBe("storage-error");
    expect(progression.unlockSkin("postman-v1").status).toBe("storage-error");
    expect(progression.unlockSkin("brown").status).toBe("storage-error");
    expect(progression.equipSkin("white").status).toBe("storage-error");
    expect(progression.purchaseUpgrade("jump").status).toBe("storage-error");
    expect(progression.awardRun(500).saveFailed).toBe(true);
    expect(values.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
});
