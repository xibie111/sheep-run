import { GAME_FEATURES, INPUT, POWER_UP } from "../game/Constants";
import { POWER_UP_DEFINITIONS, type PowerUpType } from "../data/powerups";

export type { PowerUpType } from "../data/powerups";
export interface ActivePowerUp {
  type: PowerUpType;
  remainingMs: number;
}

export class PowerUpSystem {
  private readonly expiresAt = new Map<PowerUpType, number>();

  constructor(private readonly dashEnabled: boolean = GAME_FEATURES.dash) {}

  activate(type: PowerUpType, nowMs: number): void {
    if (type === "dash" && !this.dashEnabled) return;
    const definition = POWER_UP_DEFINITIONS.find((item) => item.type === type);
    if (!definition) return;
    this.expiresAt.set(type, nowMs + definition.durationMs);
  }

  update(nowMs: number): PowerUpType[] {
    const expired: PowerUpType[] = [];
    for (const [type, expiry] of this.expiresAt) {
      if (nowMs < expiry) continue;
      this.expiresAt.delete(type);
      expired.push(type);
    }
    return expired;
  }

  isActive(type: PowerUpType, nowMs: number): boolean {
    const expiry = this.expiresAt.get(type);
    if (expiry === undefined) return false;
    if (nowMs < expiry) return true;
    this.expiresAt.delete(type);
    return false;
  }

  consumeShield(nowMs: number): boolean {
    if (!this.isActive("shield", nowMs)) return false;
    this.expiresAt.delete("shield");
    return true;
  }

  starMultiplier(nowMs: number): 1 | 2 {
    return this.isActive("starMultiplier", nowMs) ? POWER_UP.starScoreMultiplier : 1;
  }

  dashCooldownMs(nowMs: number): number {
    return this.dashEnabled && this.isActive("dash", nowMs)
      ? INPUT.dashCooldownMs * POWER_UP.dashCooldownScale
      : INPUT.dashCooldownMs;
  }

  activeEffects(nowMs: number): ActivePowerUp[] {
    this.update(nowMs);
    return [...this.expiresAt].map(([type, expiry]) => ({ type, remainingMs: expiry - nowMs }));
  }

  reset(): void {
    this.expiresAt.clear();
  }
}
