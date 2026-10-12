import { isSkinId } from "../data/sheepSkins";
import { STORAGE } from "../game/Constants";

export interface SaveData {
  version: 5;
  highScore: number;
  totalStars: number;
  spentStars: number;
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
    version: 5,
    highScore,
    totalStars: 0,
    spentStars: 0,
    coins: 0,
    selectedSkin: "white",
    unlockedSkins: ["white"],
    upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 },
    settings: { music: true, sfx: true, musicVolume: 1, sfxVolume: 1 },
  };
}

function validScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0;
}

function isStoredCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

type PersistedSaveData = Omit<Partial<SaveData>, "version" | "settings"> & {
  version?: number;
  settings?: Partial<SaveData["settings"]>;
};

function validVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function normalize(value: unknown): SaveData | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as PersistedSaveData;
  if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== 4 && candidate.version !== 5) return null;
  // Legacy schemas remain readable; explicit corrupt currency values must
  // not be silently converted into a different purchasing balance.
  if ([candidate.totalStars, candidate.coins].some((count) => count !== undefined && !isStoredCount(count))) return null;
  if (candidate.version === 5) {
    if (!isStoredCount(candidate.highScore) || !isStoredCount(candidate.totalStars) || !isStoredCount(candidate.coins)
      || !isStoredCount(candidate.spentStars) || candidate.spentStars > candidate.totalStars) return null;
    if (!Array.isArray(candidate.unlockedSkins) || !candidate.unlockedSkins.every((skin) => typeof skin === "string" && isSkinId(skin))
      || !candidate.unlockedSkins.includes("white") || typeof candidate.selectedSkin !== "string"
      || !isSkinId(candidate.selectedSkin) || !candidate.unlockedSkins.includes(candidate.selectedSkin)) return null;
    if (!candidate.upgrades || typeof candidate.upgrades !== "object"
      || !(["jump", "speed", "magnet", "dash"] as const).every((key) => isStoredCount(candidate.upgrades?.[key]) && candidate.upgrades![key] <= 5)) return null;
    if (!candidate.settings || typeof candidate.settings !== "object" || typeof candidate.settings.music !== "boolean" || typeof candidate.settings.sfx !== "boolean"
      || ![candidate.settings.musicVolume, candidate.settings.sfxVolume].every((volume) => typeof volume === "number" && Number.isFinite(volume) && volume >= 0 && volume <= 1)) return null;
  }
  const base = defaults(validScore(candidate.highScore));
  base.totalStars = validScore(candidate.totalStars);
  base.spentStars = candidate.version === 5 ? candidate.spentStars! : 0;
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
    return this.read(false) ?? defaults();
  }

  // Transactions must distinguish an unreadable save from a new player.
  static loadForTransaction(): SaveData | null {
    return this.read(true);
  }

  static availableStars(save: Pick<SaveData, "totalStars" | "spentStars"> = this.load()): number {
    return Math.max(0, save.totalStars - save.spentStars);
  }

  private static read(requirePersisted: boolean): SaveData | null {
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
        if (!normalized) {
          this.storageFailures += 1;
          return null;
        }
        if ((parsed as { version?: number }).version !== 5 && !this.save(normalized) && requirePersisted) return null;
        return normalized;
      }
      const oldValue = Number(window.localStorage.getItem(STORAGE.legacyBestKey));
      const migrated = defaults(validScore(oldValue));
      if (!this.save(migrated) && requirePersisted) return null;
      return migrated;
    } catch {
      this.storageFailures += 1;
      return null;
    }
  }

  static save(data: SaveData): boolean {
    try {
      const normalized = normalize(data);
      if (!normalized || data.version !== 5) {
        this.storageFailures += 1;
        return false;
      }
      // A caller holding fallback display data must never replace an unreadable
      // or future save. Transactions always read the current persisted balance.
      const raw = window.localStorage.getItem(STORAGE.saveKey);
      if (raw !== null && !normalize(JSON.parse(raw) as unknown)) {
        this.storageFailures += 1;
        return false;
      }
      window.localStorage.setItem(STORAGE.saveKey, JSON.stringify(normalized));
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
    save.totalStars = Math.min(Number.MAX_SAFE_INTEGER, save.totalStars + validScore(count));
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
