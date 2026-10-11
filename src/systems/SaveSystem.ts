import { isSkinId } from "../data/sheepSkins";
import { STORAGE } from "../game/Constants";

export interface SaveData {
  version: 4;
  highScore: number;
  totalStars: number;
  coins: number;
  selectedSkin: string;
  unlockedSkins: string[];
  upgrades: Record<"jump" | "speed" | "magnet" | "dash", number>;
  settings: {
    music: boolean;
    sfx: boolean;
    musicVolume: number;
    sfxVolume: number;
  };
}

function defaults(highScore = 0): SaveData {
  return {
    version: 4,
    highScore,
    totalStars: 0,
    coins: 0,
    selectedSkin: "white",
    unlockedSkins: ["white"],
    upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 },
    settings: { music: true, sfx: true, musicVolume: 1, sfxVolume: 1 },
  };
}

function validScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

type PersistedSaveData = Omit<Partial<SaveData>, "version" | "settings"> & {
  version?: number;
  settings?: Partial<SaveData["settings"]>;
};

function validVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function normalize(value: unknown): SaveData | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as PersistedSaveData;
  if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== 4) return null;
  const base = defaults(validScore(candidate.highScore));
  base.totalStars = validScore(candidate.totalStars);
  base.coins = validScore(candidate.coins);
  if (Array.isArray(candidate.unlockedSkins)) {
    const skins = candidate.unlockedSkins.filter((skin): skin is string => typeof skin === "string" && isSkinId(skin));
    base.unlockedSkins = [...new Set(["white", ...skins])];
  }
  base.selectedSkin = typeof candidate.selectedSkin === "string" && isSkinId(candidate.selectedSkin) && base.unlockedSkins.includes(candidate.selectedSkin)
    ? candidate.selectedSkin
    : "white";
  if (candidate.upgrades && typeof candidate.upgrades === "object") {
    for (const key of ["jump", "speed", "magnet", "dash"] as const) {
      const level = candidate.upgrades[key];
      base.upgrades[key] = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
    }
  }
  if (candidate.settings && typeof candidate.settings === "object") {
    base.settings.music = candidate.settings.music !== false;
    base.settings.sfx = candidate.settings.sfx !== false;
    base.settings.musicVolume = validVolume(candidate.settings.musicVolume, 1);
    base.settings.sfxVolume = validVolume(candidate.settings.sfxVolume, 1);
  }
  return base;
}

export class SaveSystem {
  private static storageFailures = 0;

  static get failureCount(): number {
    return this.storageFailures;
  }

  static load(): SaveData {
    return this.loadForTransaction() ?? defaults();
  }

  // Transactions must distinguish an unreadable save from a new player.
  static loadForTransaction(): SaveData | null {
    try {
      const raw = window.localStorage.getItem(STORAGE.saveKey);
      if (raw !== null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          parsed = null;
        }
        const normalized = normalize(parsed);
        if (normalized) {
          if ((parsed as { version?: number }).version !== 4) this.save(normalized);
          return normalized;
        }
      }
      const oldValue = Number(window.localStorage.getItem(STORAGE.legacyBestKey));
      const migrated = defaults(validScore(oldValue));
      this.save(migrated);
      return migrated;
    } catch {
      this.storageFailures += 1;
      return null;
    }
  }

  static save(data: SaveData): boolean {
    try {
      window.localStorage.setItem(STORAGE.saveKey, JSON.stringify(normalize(data) ?? defaults()));
      return true;
    } catch {
      this.storageFailures += 1;
      return false;
    }
  }

  static updateSettings(settings: Partial<SaveData["settings"]>): SaveData {
    const save = this.loadForTransaction();
    if (!save) return { ...defaults(), settings: { ...defaults().settings, ...settings } };
    save.settings = { ...save.settings, ...settings };
    this.save(save);
    return save;
  }

  static recordTotalStars(count = 1): SaveData {
    const save = this.loadForTransaction();
    if (!save) return defaults();
    save.totalStars += validScore(count);
    this.save(save);
    return save;
  }

  static recordHighScore(score: number): number {
    const safeScore = validScore(score);
    const save = this.loadForTransaction();
    if (!save) return safeScore;
    if (safeScore > save.highScore) {
      save.highScore = safeScore;
      this.save(save);
    }
    return save.highScore;
  }
}
