import { describe, expect, it } from "vitest";
import { PLAYER, POOL, POWER_UP, RUN } from "./Constants";

describe("player jump constants", () => {
  it("bounds high-jump height while retaining normal jump and gravity", () => {
    expect(PLAYER.jumpVelocityY).toBe(-500);
    expect(PLAYER.gravityY).toBe(1450);
    expect(Math.abs(PLAYER.highJumpVelocityY)).toBeLessThanOrEqual(PLAYER.maxHighJumpSpeed);
    expect(PLAYER.maxHighJumpSpeed ** 2 / (2 * PLAYER.gravityY)).toBeLessThan(121);
  });
});

describe("Phase 5 power-up configuration", () => {
  it("sets bounded durations and effect strengths", () => {
    expect(POWER_UP?.durationsMs).toEqual({ magnet: 8000, shield: 6000, starMultiplier: 8000, dash: 7000 });
    expect(POWER_UP?.magnetRadiusPx).toBe(110);
    expect(POWER_UP?.dashCooldownScale).toBe(0.5);
    expect(POWER_UP?.starScoreMultiplier).toBe(2);
    expect(POWER_UP?.spawnDelaySeconds).toBe(14);
    expect(POWER_UP?.spawnIntervalMinSeconds).toBe(16);
    expect(POWER_UP?.spawnIntervalMaxSeconds).toBe(22);
  });

  it("bounds concurrently visible pickups", () => {
    expect(POOL.powerUps).toBe(2);
  });
});

describe("Phase 4 spawn and pool configuration", () => {
  it("keeps a safe opening and enough obstacle gap for reaction and jumping", () => {
    expect(RUN.safeSpawnWindow).toBe(1.25);
    expect(RUN.minimumReactionTime).toBe(0.9);
    expect(RUN.minimumJumpDistance).toBe(250);
    expect(RUN.obstacleSpacing).toBe(220);
    expect(RUN.obstacleGapVariation).toBe(80);
  });

  it("caps per-kind obstacles and concurrent stars", () => {
    expect(POOL.obstaclesPerKind).toBe(3);
    expect(POOL.stars).toBe(3);
  });
});

describe("Phase 6 environment configuration", () => {
  it("centralizes the established visual schedule, parallax layers, and bounded chunks", async () => {
    const constants = await import("./Constants");

    expect(constants.ENVIRONMENT).toBeDefined();
    if (!constants.ENVIRONMENT) return;
    expect(constants.ENVIRONMENT).toMatchObject({
      dayPhaseDistancePx: 3000,
      seasonLengthPx: 12000,
      weatherSegmentDistancePx: 8000,
      tintTransitionDistancePx: 600,
      weatherFadeDistancePx: 600,
      maxRainParticles: 64,
      maxWindParticles: 12,
      chunkWidthPx: 480,
      chunksBehind: 1,
      chunksAhead: 3,
      maxChunks: 6,
      parallaxRatios: {
        sky: 0,
        cloud: 0.07,
        farMountain: 0.15,
        treeLine: 0.24,
        farmBuilding: 0.34,
        field: 0.48,
        fence: 0.65,
        ground: 1,
        foregroundGrass: 1.25,
      },
    });
    expect(new Set(Object.values(constants.ENVIRONMENT.parallaxRatios)).size).toBe(9);
  });
});
