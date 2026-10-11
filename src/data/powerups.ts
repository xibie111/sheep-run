import { COLORS, POWER_UP } from "../game/Constants";

export const POWER_UP_DEFINITIONS = [
  { type: "magnet", textureKey: "powerup-magnet", label: "磁铁", color: COLORS.coral, durationMs: POWER_UP.durationsMs.magnet },
  { type: "shield", textureKey: "powerup-shield", label: "护盾", color: COLORS.sky, durationMs: POWER_UP.durationsMs.shield },
  { type: "starMultiplier", textureKey: "powerup-starMultiplier", label: "双星", color: COLORS.yellow, durationMs: POWER_UP.durationsMs.starMultiplier },
  { type: "dash", textureKey: "powerup-dash", label: "冲刺", color: COLORS.mint, durationMs: POWER_UP.durationsMs.dash },
] as const;

export type PowerUpType = (typeof POWER_UP_DEFINITIONS)[number]["type"];
