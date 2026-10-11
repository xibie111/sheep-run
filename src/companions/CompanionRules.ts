import { PLAYER } from "../game/Constants";
import { isSkinId, type SkinId } from "../data/sheepSkins";

export const COMPANION_RULES = {
  firstEligibleMs: 25_000,
  cooldownMinMs: 35_000,
  cooldownMaxMs: 50_000,
  visitMs: 10_000,
  entranceMs: 1_000,
  farewellMs: 1_000,
  scale: .85,
  sheepGapPx: 12,
  bellWidth: 22,
  bellHeight: 24,
  bellAboveGroundPx: 19,
  recycleX: -30,
  trailingRecoverySeconds: .95,
  leadingRecoverySeconds: .4,
  pickupPaddingPx: 12,
} as const;

/** A stream owned only by companions; never calls Math.random or SpawnSystem. */
export class CompanionRandom {
  private value: number;
  constructor(seed: number) { this.value = (seed >>> 0) || 0x6d2b79f5; }
  next(): number {
    let value = this.value; value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.value = value >>> 0; return this.value / 0x1_0000_0000;
  }
}

let fallbackSeed = 0x51eed123;
export function companionSeed(): number {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  // No wall clock or shared randomness even on hosts without crypto.
  fallbackSeed = (fallbackSeed + 0x9e3779b9) >>> 0; return fallbackSeed;
}

export function chooseCompanionSkin(unlocked: readonly unknown[], lead: SkinId, random: () => number): SkinId {
  const candidates = [...new Set(unlocked.filter((id): id is SkinId => typeof id === "string" && isSkinId(id)))].filter(id => id !== lead);
  if (!candidates.length) return "white";
  return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))]!;
}

export function companionTrailingX(leadX: number, leadWidth: number = PLAYER.displayWidth): number {
  return leadX - leadWidth / 2 - leadWidth * COMPANION_RULES.scale / 2 - COMPANION_RULES.sheepGapPx;
}
