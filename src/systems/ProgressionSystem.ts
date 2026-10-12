import { GAME_FEATURES, INPUT, POWER_UP } from "../game/Constants";
import { SHEEP_SKINS, isSkinId, type SkinId } from "../data/sheepSkins";
import { SaveSystem, type SaveData } from "./SaveSystem";

export interface RunReward {
  coinsEarned: number;
  coinBalance: number;
  saveFailed?: true;
}

export interface RunProgression {
  effects: UpgradeEffects;
  skinId: SkinId;
}

export interface SkinUnlockResult {
  status: "unlocked" | "already-unlocked" | "insufficient-stars" | "insufficient-coins" | "unknown" | "storage-error";
  skinId: SkinId | string;
  required?: number;
  available?: number;
  cost?: number;
  coinBalance?: number;
  starBalance?: number;
}

export interface SkinEquipResult {
  status: "equipped" | "locked" | "unknown" | "storage-error";
  skinId: SkinId | string;
}

export type UpgradeId = "jump" | "speed" | "magnet" | "dash";

export interface UpgradePurchaseResult {
  status: "purchased" | "insufficient-coins" | "max-level" | "disabled" | "storage-error";
  upgrade: UpgradeId;
  level: number;
  cost: number;
  coinBalance: number;
}

export interface UpgradeEffects {
  jumpImpulseMultiplier: number;
  worldSpeedMultiplier: number;
  magnetRadiusPx: number;
  dashInvulnerabilityMs: number;
}

const UPGRADE_COSTS: readonly number[] = [3, 5, 8, 12, 18];

export class ProgressionSystem {
  static currentEffects(): UpgradeEffects {
    return this.effectsFor(SaveSystem.load().upgrades);
  }

  static currentRun(): RunProgression {
    const save = SaveSystem.load();
    const skinId = isSkinId(save.selectedSkin) ? save.selectedSkin : "white";
    return { effects: this.effectsFor(save.upgrades), skinId };
  }

  static effectsFor(levels: SaveData["upgrades"]): UpgradeEffects {
    return {
      jumpImpulseMultiplier: 1 + levels.jump * 0.03,
      worldSpeedMultiplier: 1 + levels.speed * 0.02,
      magnetRadiusPx: POWER_UP.magnetRadiusPx + levels.magnet * 12,
      dashInvulnerabilityMs: GAME_FEATURES.dash
        ? INPUT.dashInvulnerabilityMs + levels.dash * 30
        : INPUT.dashInvulnerabilityMs,
    };
  }

  static upgradeCost(level: number): number | null {
    if (!Number.isInteger(level) || level < 0 || level >= UPGRADE_COSTS.length) return null;
    return UPGRADE_COSTS[level] ?? null;
  }

  awardRun(finalScore: number): RunReward {
    const score = Number.isFinite(finalScore) ? Math.max(0, Math.floor(finalScore)) : 0;
    const coinsEarned = Math.min(20, Math.floor(score / 25));
    const save = SaveSystem.loadForTransaction();
    if (!save) return { coinsEarned, coinBalance: 0, saveFailed: true };
    const previousBalance = save.coins;
    save.coins += coinsEarned;
    if (!SaveSystem.save(save)) return { coinsEarned, coinBalance: previousBalance, saveFailed: true };
    return { coinsEarned, coinBalance: save.coins };
  }

  unlockSkin(skinId: string): SkinUnlockResult {
    const skin = isSkinId(skinId) ? SHEEP_SKINS.find((candidate) => candidate.id === skinId) : undefined;
    if (!skin) return { status: "unknown", skinId };
    const save = SaveSystem.loadForTransaction();
    if (!save) return { status: "storage-error", skinId };
    if (save.unlockedSkins.includes(skin.id)) return { status: "already-unlocked", skinId: skin.id, cost: 0, coinBalance: save.coins };

    if (skin.unlock.type === "stars") {
      if (save.totalStars < skin.unlock.amount) return { status: "insufficient-stars", skinId: skin.id, required: skin.unlock.amount, available: save.totalStars, coinBalance: save.coins };
      save.unlockedSkins = [...new Set([...save.unlockedSkins, skin.id])];
      if (!SaveSystem.save(save)) return { status: "storage-error", skinId, coinBalance: save.coins };
      return { status: "unlocked", skinId: skin.id, cost: 0, coinBalance: save.coins };
    }
    if (skin.unlock.type === "star-purchase") {
      const previousBalance = SaveSystem.availableStars(save);
      if (previousBalance < skin.unlock.amount) return { status: "insufficient-stars", skinId: skin.id, required: skin.unlock.amount, available: previousBalance, starBalance: previousBalance, coinBalance: save.coins };
      save.spentStars += skin.unlock.amount;
      save.unlockedSkins = [...new Set([...save.unlockedSkins, skin.id])];
      if (!SaveSystem.save(save)) return { status: "storage-error", skinId, starBalance: previousBalance, coinBalance: save.coins };
      return { status: "unlocked", skinId: skin.id, cost: skin.unlock.amount, starBalance: SaveSystem.availableStars(save), coinBalance: save.coins };
    }
    if (save.coins < skin.unlock.amount) return { status: "insufficient-coins", skinId: skin.id, required: skin.unlock.amount, available: save.coins };
    const previousBalance = save.coins;
    save.coins -= skin.unlock.amount;
    save.unlockedSkins = [...new Set([...save.unlockedSkins, skin.id])];
    if (!SaveSystem.save(save)) return { status: "storage-error", skinId, coinBalance: previousBalance };
    return { status: "unlocked", skinId: skin.id, cost: skin.unlock.amount, coinBalance: save.coins };
  }

  equipSkin(skinId: string): SkinEquipResult {
    if (!isSkinId(skinId)) return { status: "unknown", skinId };
    const save = SaveSystem.loadForTransaction();
    if (!save) return { status: "storage-error", skinId };
    if (!save.unlockedSkins.includes(skinId)) return { status: "locked", skinId };
    save.selectedSkin = skinId;
    if (!SaveSystem.save(save)) return { status: "storage-error", skinId };
    return { status: "equipped", skinId };
  }

  purchaseUpgrade(upgrade: UpgradeId): UpgradePurchaseResult {
    const save = SaveSystem.loadForTransaction();
    if (!save) return { status: "storage-error", upgrade, level: 0, cost: 0, coinBalance: 0 };
    const level = save.upgrades[upgrade];
    if (upgrade === "dash" && !GAME_FEATURES.dash) {
      return { status: "disabled", upgrade, level, cost: 0, coinBalance: save.coins };
    }
    const cost = ProgressionSystem.upgradeCost(level);
    if (cost === null) {
      return { status: "max-level", upgrade, level, cost: 0, coinBalance: save.coins };
    }
    if (save.coins < cost) {
      return { status: "insufficient-coins", upgrade, level, cost, coinBalance: save.coins };
    }

    const previousBalance = save.coins;
    save.coins -= cost;
    save.upgrades[upgrade] = level + 1;
    if (!SaveSystem.save(save)) return { status: "storage-error", upgrade, level, cost, coinBalance: previousBalance };
    return { status: "purchased", upgrade, level: level + 1, cost, coinBalance: save.coins };
  }
}
