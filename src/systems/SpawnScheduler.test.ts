import { describe, expect, it } from "vitest";
import { GAME_FEATURES, PLAYER, POOL, POWER_UP, RUN, WORLD } from "../game/Constants";
import { DifficultySystem } from "./DifficultySystem";
import { SpawnSystem, type SpawnRequest } from "./SpawnSystemOwner";
import { OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";

function isPowerUpSpawn(item: { at: number; request: SpawnRequest }): item is { at: number; request: Extract<SpawnRequest, { type: "powerUp" }> } {
  return item.request.type === "powerUp";
}

function trace(seed: number, speed: number, duration: number, dashEnabled: boolean = GAME_FEATURES.dash): Array<{ at: number; request: SpawnRequest }> {
  const spawn = new SpawnSystem(seed, dashEnabled);
  const result: Array<{ at: number; request: SpawnRequest }> = [];
  const step = 0.01;
  for (let frame = 1; frame <= Math.ceil(duration / step); frame += 1) {
    const elapsed = frame * step;
    for (const request of spawn.update(step, speed)) result.push({ at: elapsed, request });
  }
  return result;
}

describe("SpawnScheduler", () => {
  it("reports a read-only star route forecast without skipping the opening or continuing obstacle groups", () => {
    const spawn = new SpawnSystem(876);
    spawn.update(RUN.safeSpawnWindow - .01, RUN.initialSpeed);
    expect(spawn.starRouteWindow(RUN.initialSpeed).openingSafe).toBe(false);
    expect(spawn.starRouteWindow(RUN.initialSpeed).nextObstacleInPx).toBeCloseTo(RUN.initialSpeed * .01);
    let foundContinuous = false;
    for (let frame = 0; frame < 2000; frame += 1) {
      const requests = spawn.update(.04, RUN.initialSpeed);
      const forecast = spawn.starRouteWindow(RUN.initialSpeed);
      expect(forecast.openingSafe).toBe(true);
      expect(forecast.nextObstacleInPx).toBeGreaterThanOrEqual(0);
      for (const request of requests) if (request.type === 'obstacle') {
        expect(forecast.patternEnded).toBe(request.pattern.index === request.pattern.length - 1);
        expect(forecast.nextObstacleInPx).toBeGreaterThan(request.definition.width);
        if (!forecast.patternEnded) foundContinuous = true;
      }
    }
    expect(foundContinuous).toBe(true);
    expect(spawn.starRouteWindow(Number.NaN).nextObstacleInPx).toBe(0);
  });
  it("spawns every registered type even at the initial speed", () => {
    for (const speed of [RUN.initialSpeed, 269.9, 270, RUN.maxSpeed]) {
      const obstacles = trace(78, speed, 600).flatMap(item => item.request.type === "obstacle" ? [item.request.definition.kind] : []);
      const expected = OBSTACLE_DEFINITIONS.map(definition => definition.kind);
      expect(new Set(obstacles)).toEqual(new Set(expected));
    }
  });

  it("keeps the seeded obstacle sequence independent of speed", () => {
    const sequence = (speed: number) => trace(78, speed, 600).flatMap(item => item.request.type === "obstacle"
      ? [{ kind: item.request.definition.kind, pattern: item.request.pattern }] : []).slice(0, 100);
    const initial = sequence(RUN.initialSpeed);
    expect(initial).toHaveLength(100);
    for (const speed of [269.9, 270, RUN.maxSpeed, RUN.maxSpeed * 1.1]) expect(sequence(speed)).toEqual(initial);
  });
  it("waits for the safe opening window and reproduces a seeded pattern", () => {
    const first = trace(42, RUN.initialSpeed, 20);
    const repeated = trace(42, RUN.initialSpeed, 20);
    const different = trace(43, RUN.initialSpeed, 20);

    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(repeated);
    expect(first).not.toEqual(different);
    expect(first.find((item) => item.request.type === "obstacle")?.at).toBeGreaterThanOrEqual(RUN.safeSpawnWindow);
    expect(first.find((item) => item.request.type === "obstacle")?.at).toBeLessThan(RUN.safeSpawnWindow + 0.01);
  });

  it("adds reproducible low-density power-up requests after the opening window", () => {
    const first = trace(876, RUN.initialSpeed, 120, true).filter(isPowerUpSpawn);
    const repeated = trace(876, RUN.initialSpeed, 120, true).filter(isPowerUpSpawn);
    const different = trace(877, RUN.initialSpeed, 120, true).filter(isPowerUpSpawn);
    const generatedKinds = new Set(Array.from({ length: 16 }, (_, index) =>
      trace(index + 1, RUN.initialSpeed, 120, true).filter(isPowerUpSpawn).map((item) => item.request.powerUp),
    ).flat());

    expect(first.length).toBeGreaterThan(3);
    expect(first).toEqual(repeated);
    expect(first).not.toEqual(different);
    expect(first[0]!.at).toBeGreaterThanOrEqual(POWER_UP.spawnDelaySeconds);
    expect(first[0]!.at).toBeLessThan(POWER_UP.spawnDelaySeconds + 0.02);
    expect(generatedKinds).toEqual(new Set(["magnet", "shield", "starMultiplier", "dash"]));
  });

  it("excludes Dash from default PowerUp spawn requests", () => {
    const generatedKinds = new Set(Array.from({ length: 16 }, (_, index) =>
      trace(index + 1, RUN.initialSpeed, 120).filter(isPowerUpSpawn).map((item) => item.request.powerUp),
    ).flat());

    expect(generatedKinds).toEqual(new Set(["magnet", "shield", "starMultiplier"]));
  });

  it("keeps edge-to-edge hazard gaps legal across the speed range", () => {
    for (const speed of [RUN.initialSpeed, 270, RUN.maxSpeed]) {
      const obstacles = trace(100 + speed, speed, 60).filter((item) => item.request.type === "obstacle");
      for (let index = 1; index < obstacles.length; index += 1) {
        const previous = obstacles[index - 1]!;
        const current = obstacles[index]!;
        if (previous.request.type !== "obstacle" || current.request.type !== "obstacle") continue;
        const gap = (current.at - previous.at) * speed - previous.request.definition.width;
        const required = Math.max(RUN.minimumJumpDistance, RUN.obstacleSpacing, speed * RUN.minimumReactionTime);
        expect(gap + speed * 0.01, JSON.stringify({ speed, previousAt: previous.at, previousWidth: previous.request.definition.width, currentAt: current.at, gap, required }))
          .toBeGreaterThanOrEqual(required - 0.01);
      }
    }
  });

  it("keeps seeded long-run active-object counts within pool capacities", () => {
    const step = 0.04;
    for (let seed = 1; seed <= 32; seed += 1) {
      const difficulty = new DifficultySystem();
      const spawn = new SpawnSystem(seed);
      let distance = 0;
      const obstacles: Array<{ kind: string; width: number; at: number }> = [];
      const stars: number[] = [];
      const powerUps: number[] = [];
      const peakByKind = new Map<string, number>();
      let peakStars = 0;
      let peakPowerUps = 0;
      let spawnedObstacles = 0;
      let spawnedStars = 0;
      let spawnedPowerUps = 0;

      for (let frame = 0; frame < 10_000; frame += 1) {
        const speed = difficulty.update(step);
        distance += speed * step;
        for (let index = obstacles.length - 1; index >= 0; index -= 1) {
          const obstacle = obstacles[index]!;
          if (distance - obstacle.at >= WORLD.width + 18 + obstacle.width + 20) obstacles.splice(index, 1);
        }
        for (let index = stars.length - 1; index >= 0; index -= 1) {
          if (distance - stars[index]! >= WORLD.width + 14 - (PLAYER.x - 4)) stars.splice(index, 1);
        }
        for (let index = powerUps.length - 1; index >= 0; index -= 1) {
          if (distance - powerUps[index]! >= WORLD.width + 14 - (PLAYER.x - 4)) powerUps.splice(index, 1);
        }

        for (const request of spawn.update(step, speed)) {
          if (request.type === "obstacle") {
            spawnedObstacles += 1;
            obstacles.push({ kind: request.definition.kind, width: request.definition.width, at: distance });
            const activeOfKind = obstacles.filter((item) => item.kind === request.definition.kind).length;
            peakByKind.set(request.definition.kind, Math.max(peakByKind.get(request.definition.kind) ?? 0, activeOfKind));
          } else if (request.type === "star") {
            spawnedStars += 1;
            stars.push(distance);
            peakStars = Math.max(peakStars, stars.length);
          } else {
            spawnedPowerUps += 1;
            powerUps.push(distance);
            peakPowerUps = Math.max(peakPowerUps, powerUps.length);
          }
        }
      }

      expect(spawnedObstacles).toBeGreaterThan(100);
      expect(spawnedStars).toBeGreaterThan(100);
      expect(spawnedPowerUps).toBeGreaterThan(10);
      for (const peak of peakByKind.values()) expect(peak).toBeLessThanOrEqual(POOL.obstaclesPerKind);
      expect(peakStars).toBeLessThanOrEqual(POOL.stars);
      expect(peakPowerUps).toBeLessThanOrEqual(POOL.powerUps);
    }
  });
});
