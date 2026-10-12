import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../game/Constants";
import { SaveSystem, type SaveData } from "./SaveSystem";

const VALID_SAVE: SaveData = {
  version: 5,
  highScore: 37,
  totalStars: 120,
  spentStars: 80,
  coins: 75,
  selectedSkin: "black",
  unlockedSkins: ["white", "black", "brown"],
  upgrades: { jump: 2, speed: 1, magnet: 3, dash: 0 },
  settings: { music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 },
};

function installStorage(initial: Record<string, string> = {}): Map<string, string> {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  });
  return values;
}

describe("SaveSystem schema migration", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("returns whether a write persisted and counts storage failures", () => {
    installStorage();
    const data = SaveSystem.load();
    expect(SaveSystem.save(data)).toBe(true);
    const failures = SaveSystem.failureCount;
    vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error("full"); });
    expect(SaveSystem.save(data)).toBe(false);
    expect(SaveSystem.failureCount).toBe(failures + 1);
  });

  it("migrates a v1 save without losing fields and writes v5", () => {
    const storage = installStorage({
      [STORAGE.saveKey]: JSON.stringify({
        version: 1,
        highScore: 19,
        totalStars: 7,
        unlockedSkins: ["white", "brown"],
        upgrades: { jump: 2, speed: 1, magnet: 0, dash: 3 },
        settings: { music: false, sfx: true },
      }),
    });

    const save = SaveSystem.load();

    expect(save).toMatchObject({ version: 5, highScore: 19, totalStars: 7, spentStars: 0, unlockedSkins: ["white", "brown"], upgrades: { jump: 2, speed: 1, dash: 3 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: 1 } });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(5);
  });

  it("migrates a v2 save into v5 without losing fields", () => {
    const storage = installStorage({
      [STORAGE.saveKey]: JSON.stringify({
        version: 2,
        highScore: 178,
        totalStars: 12,
        unlockedSkins: ["white", "brown"],
        upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 },
        settings: { music: false, sfx: true },
      }),
    });

    const save = SaveSystem.load();

    expect(save).toMatchObject({ version: 5, highScore: 178, totalStars: 12, spentStars: 0, unlockedSkins: ["white", "brown"], upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: 1 } });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(5);
  });

  it("migrates a v3 save to v5 with coin, spent-star and skin defaults while preserving progress", () => {
    const storage = installStorage({
      [STORAGE.saveKey]: JSON.stringify({
        version: 3,
        highScore: 178,
        totalStars: 12,
        unlockedSkins: ["white", "brown"],
        upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 },
        settings: { music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 },
      }),
    });

    const save = SaveSystem.load();

    expect(save).toMatchObject({
      version: 5,
      highScore: 178,
      totalStars: 12,
      spentStars: 0,
      unlockedSkins: ["white", "brown"],
      upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 },
      coins: 0,
      selectedSkin: "white",
      settings: { music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 },
    });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(5);
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).coins).toBe(0);
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).selectedSkin).toBe("white");
  });

  it("protects malformed new data instead of replacing it with legacy or empty data", () => {
    const storage = installStorage({ [STORAGE.saveKey]: "{broken", [STORAGE.legacyBestKey]: "37" });

    const save = SaveSystem.load();

    expect(save.version).toBe(5);
    expect(save.highScore).toBe(0);
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(SaveSystem.save(save)).toBe(false);
    expect(storage.get(STORAGE.legacyBestKey)).toBe("37");
    expect(storage.get(STORAGE.saveKey)).toBe("{broken");
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("persists lifetime stars and partial settings updates", () => {
    const storage = installStorage();

    SaveSystem.recordTotalStars(3);
    SaveSystem.recordTotalStars(2);
    const save = SaveSystem.updateSettings({ music: false, musicVolume: 0.4, sfxVolume: 0.2 });

    expect(save.totalStars).toBe(5);
    expect(save.settings).toEqual({ music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).settings).toEqual({ music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 });
  });

  it("clamps malformed fields and survives unavailable browser storage", () => {
    installStorage({
      [STORAGE.saveKey]: JSON.stringify({
        version: 2,
        highScore: -10,
        totalStars: 2,
        selectedSkin: "phantom",
        upgrades: { jump: 99 },
        unlockedSkins: ["brown", "brown", "ghost", 2],
        settings: { music: false, musicVolume: 4, sfxVolume: -2 },
      }),
    });
    expect(SaveSystem.load()).toMatchObject({ highScore: 0, totalStars: 2, selectedSkin: "white", unlockedSkins: ["white", "brown"], upgrades: { jump: 5, speed: 0 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: 0 } });

    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    expect(() => SaveSystem.recordTotalStars(1)).not.toThrow();
    expect(SaveSystem.load().highScore).toBe(0);
  });

  it("migrates v4 history to unspent v5 stars and preserves the entire equipped economy", () => {
    const { spentStars: _spentStars, ...legacy } = VALID_SAVE;
    const storage = installStorage({ [STORAGE.saveKey]: JSON.stringify({ ...legacy, version: 4 }) });
    expect(SaveSystem.loadForTransaction()).toEqual({ ...VALID_SAVE, spentStars: 0 });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!)).toEqual({ ...VALID_SAVE, spentStars: 0 });
    expect(SaveSystem.availableStars(SaveSystem.load())).toBe(120);
    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("preserves spent stars through later stars, high scores and settings writes", () => {
    const storage = installStorage({ [STORAGE.saveKey]: JSON.stringify(VALID_SAVE) });
    SaveSystem.recordTotalStars(5);
    SaveSystem.recordHighScore(80);
    SaveSystem.updateSettings({ sfx: false, musicVolume: 0.25 });
    const saved = SaveSystem.load();
    expect(saved).toEqual({ ...VALID_SAVE, totalStars: 125, highScore: 80, settings: { ...VALID_SAVE.settings, sfx: false, musicVolume: 0.25 } });
    expect(SaveSystem.availableStars(saved)).toBe(45);
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).spentStars).toBe(80);
  });

  it("does not rewrite current saves just by reading", () => {
    installStorage({ [STORAGE.saveKey]: JSON.stringify(VALID_SAVE) });
    expect(SaveSystem.load()).toEqual(VALID_SAVE);
    expect(SaveSystem.loadForTransaction()).toEqual(VALID_SAVE);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    { spentStars: -1 }, { spentStars: 1.5 }, { spentStars: "20" }, { spentStars: 121 },
    { spentStars: undefined }, { totalStars: 120.5 }, { coins: -5 },
    { selectedSkin: "golden" }, { unlockedSkins: ["white", "phantom"] },
    { upgrades: { ...VALID_SAVE.upgrades, jump: 6 } },
    { settings: { ...VALID_SAVE.settings, sfxVolume: 2 } },
  ])("refuses corrupt v5 fields without modifying the raw save: %j", (override) => {
    const raw = JSON.stringify({ ...VALID_SAVE, ...override });
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(SaveSystem.load()).toMatchObject({ version: 5, totalStars: 0, spentStars: 0 });
    SaveSystem.recordTotalStars(3);
    SaveSystem.recordHighScore(100);
    SaveSystem.updateSettings({ music: true });
    expect(SaveSystem.save(VALID_SAVE)).toBe(false);
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("protects future save versions even if callers hold default display data", () => {
    const raw = JSON.stringify({ ...VALID_SAVE, version: 6, futureField: { valid: true } });
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    const displayed = SaveSystem.load();
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(SaveSystem.save(displayed)).toBe(false);
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([{ totalStars: -1 }, { totalStars: 1.1 }, { coins: "30" }])("rejects damaged v4 currency rather than migrating a false balance: %j", (override) => {
    const raw = JSON.stringify({ ...VALID_SAVE, version: 4, ...override });
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("protects damaged pre-v4 currency instead of inventing a rounded balance (v%i)", (version) => {
    const raw = JSON.stringify({ version, totalStars: 30.5, highScore: 37 });
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    const failures = SaveSystem.failureCount;
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(SaveSystem.failureCount).toBe(failures + 1);
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("retains readable old progress but rejects transactions while migration cannot persist", () => {
    const raw = JSON.stringify({ ...VALID_SAVE, version: 4 });
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    const write = vi.mocked(window.localStorage.setItem);
    write.mockImplementation(() => { throw new Error("storage full"); });
    expect(SaveSystem.load()).toEqual({ ...VALID_SAVE, spentStars: 0 });
    expect(SaveSystem.loadForTransaction()).toBeNull();
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    write.mockImplementation((key, value) => storage.set(key, value));
    expect(SaveSystem.loadForTransaction()).toEqual({ ...VALID_SAVE, spentStars: 0 });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(5);
  });

  it("does not turn invalid direct writes into empty saves", () => {
    const raw = JSON.stringify(VALID_SAVE);
    const storage = installStorage({ [STORAGE.saveKey]: raw });
    expect(SaveSystem.save({ ...VALID_SAVE, spentStars: 121 })).toBe(false);
    expect(storage.get(STORAGE.saveKey)).toBe(raw);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
});
