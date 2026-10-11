import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../game/Constants";
import { SaveSystem } from "./SaveSystem";

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

  it("migrates a v1 save without losing fields and writes v3", () => {
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

    expect(save).toMatchObject({ version: 4, highScore: 19, totalStars: 7, unlockedSkins: ["white", "brown"], upgrades: { jump: 2, speed: 1, dash: 3 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: 1 } });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(4);
  });

  it("migrates a v2 save into the volume-complete v3 schema without losing fields", () => {
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

    expect(save).toMatchObject({ version: 4, highScore: 178, totalStars: 12, unlockedSkins: ["white", "brown"], upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: 1 } });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(4);
  });

  it("migrates a v3 save to v4 with coin and skin defaults while preserving progress", () => {
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
      version: 4,
      highScore: 178,
      totalStars: 12,
      unlockedSkins: ["white", "brown"],
      upgrades: { jump: 2, speed: 1, magnet: 3, dash: 1 },
      coins: 0,
      selectedSkin: "white",
      settings: { music: false, sfx: true, musicVolume: 0.4, sfxVolume: 0.2 },
    });
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).version).toBe(4);
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).coins).toBe(0);
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).selectedSkin).toBe("white");
  });

  it("recovers malformed new data from the legacy score without deleting its key", () => {
    const storage = installStorage({ [STORAGE.saveKey]: "{broken", [STORAGE.legacyBestKey]: "37" });

    const save = SaveSystem.load();

    expect(save.version).toBe(4);
    expect(save.highScore).toBe(37);
    expect(storage.get(STORAGE.legacyBestKey)).toBe("37");
    expect(JSON.parse(storage.get(STORAGE.saveKey)!).highScore).toBe(37);
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
        totalStars: 2.9,
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
});
