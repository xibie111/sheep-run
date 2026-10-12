import { GAME_FEATURES, POWER_UP, RUN, WORLD } from "../game/Constants";
import type { ObstacleDefinition } from "../game/ObstacleDefinitions";
import { POWER_UP_DEFINITIONS, type PowerUpType } from "../data/powerups";
import { availableObstaclePatterns, obstacleGap, type ObstaclePattern } from "./ObstaclePatterns";

export type SpawnRequest =
  | { type: "obstacle"; definition: ObstacleDefinition; phase: number; pattern: { id: string; index: number; length: number } }
  | { type: "star"; y: number; phase: number }
  | { type: "powerUp"; powerUp: PowerUpType; y: number; phase: number };

/** Read-only forecast for cosmetic pickup placement; it never advances a stream. */
export interface StarRouteWindow {
  readonly openingSafe: boolean;
  readonly patternEnded: boolean;
  readonly nextObstacleInPx: number;
}

export class SpawnSystem {
  private randomState = 1;
  private obstacleRandomState = 1;
  private openingTimer = 1;
  private obstacleDistance = 0;
  private lastObstacle: ObstacleDefinition | null = null;
  private pattern: ObstaclePattern | null = null;
  private patternIndex = 0;
  private obstaclesSpawned = 0;
  private gapVariation = 0;
  private jumpImpulseMultiplier = 1;
  private starTimer = 1;
  private powerUpTimer = 1;

  constructor(seed?: number, private readonly dashEnabled: boolean = GAME_FEATURES.dash) {
    this.reset(seed);
  }

  reset(seed?: number, jumpImpulseMultiplier = 1): void {
    const initialSeed = seed ?? Math.floor(Math.random() * 0x1_0000_0000);
    this.randomState = (initialSeed >>> 0) || 0x9e3779b9;
    this.obstacleRandomState = (this.randomState ^ 0x85ebca6b) >>> 0 || 0x9e3779b9;
    this.openingTimer = RUN.safeSpawnWindow;
    this.obstacleDistance = 0;
    this.lastObstacle = null;
    this.pattern = null;
    this.patternIndex = 0;
    this.obstaclesSpawned = 0;
    this.gapVariation = 0;
    this.jumpImpulseMultiplier = Number.isFinite(jumpImpulseMultiplier) ? Math.max(1, jumpImpulseMultiplier) : 1;
    this.starTimer = RUN.starSpawnDelay;
    this.powerUpTimer = POWER_UP.spawnDelaySeconds;
  }

  update(deltaSeconds: number, speed: number): SpawnRequest[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !Number.isFinite(speed) || speed <= 0) return [];

    this.openingTimer -= deltaSeconds;
    this.obstacleDistance += speed * deltaSeconds;
    this.starTimer -= deltaSeconds;
    this.powerUpTimer -= deltaSeconds;
    const requests: SpawnRequest[] = [];

    const betweenPatterns = !this.pattern || this.patternIndex >= this.pattern.obstacles.length;
    // Measure actual travel rather than fixing a timer at an earlier, slower speed.
    const requiredDistance = this.lastObstacle
      ? this.lastObstacle.width + obstacleGap(speed, this.jumpImpulseMultiplier, betweenPatterns) + this.gapVariation
      : 0;
    if (this.openingTimer <= 0 && this.obstacleDistance >= requiredDistance) {
      if (betweenPatterns) {
        const candidates = availableObstaclePatterns(this.obstaclesSpawned).filter(pattern => pattern.id !== this.pattern?.id);
        this.pattern = candidates[Math.floor(this.nextObstacleRandom() * candidates.length)]!;
        this.patternIndex = 0;
      }
      const pattern = this.pattern!;
      const definition = pattern.obstacles[this.patternIndex]!;
      requests.push({ type: "obstacle", definition, phase: this.nextObstacleRandom() * Math.PI * 2,
        pattern: { id: pattern.id, index: this.patternIndex, length: pattern.obstacles.length } });
      this.patternIndex += 1;
      this.obstaclesSpawned += 1;
      this.lastObstacle = definition;
      this.obstacleDistance = 0;
      this.gapVariation = this.nextObstacleRandom() * RUN.obstacleGapVariation;
    }

    if (this.starTimer <= 0) {
      requests.push({
        type: "star",
        y: WORLD.groundY - (64 + this.nextRandom() * 46),
        phase: this.nextRandom() * Math.PI * 2,
      });
      this.starTimer += RUN.starIntervalMin + this.nextRandom() * (RUN.starIntervalMax - RUN.starIntervalMin);
    }

    if (this.powerUpTimer <= 0) {
      const candidates = this.dashEnabled
        ? POWER_UP_DEFINITIONS
        : POWER_UP_DEFINITIONS.filter((definition) => definition.type !== "dash");
      requests.push({
        type: "powerUp",
        powerUp: candidates[Math.floor(this.nextRandom() * candidates.length)]!.type,
        y: WORLD.groundY - (70 + this.nextRandom() * 26),
        phase: this.nextRandom() * Math.PI * 2,
      });
      this.powerUpTimer = POWER_UP.spawnIntervalMinSeconds
        + this.nextRandom() * (POWER_UP.spawnIntervalMaxSeconds - POWER_UP.spawnIntervalMinSeconds);
    }

    return requests;
  }

  starRouteWindow(speed: number): StarRouteWindow {
    const patternEnded = !this.pattern || this.patternIndex >= this.pattern.obstacles.length;
    const requiredDistance = this.lastObstacle
      ? this.lastObstacle.width + obstacleGap(speed, this.jumpImpulseMultiplier, patternEnded) + this.gapVariation
      : 0;
    return {
      openingSafe: this.openingTimer <= 0,
      patternEnded,
      nextObstacleInPx: Number.isFinite(speed) && speed > 0
        ? Math.max(0, requiredDistance - this.obstacleDistance, this.openingTimer * speed)
        : 0,
    };
  }

  private nextRandom(): number {
    this.randomState = this.advanceRandom(this.randomState);
    return this.randomState / 0x1_0000_0000;
  }

  private nextObstacleRandom(): number {
    this.obstacleRandomState = this.advanceRandom(this.obstacleRandomState);
    return this.obstacleRandomState / 0x1_0000_0000;
  }

  private advanceRandom(state: number): number {
    let value = state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value >>> 0;
  }
}
