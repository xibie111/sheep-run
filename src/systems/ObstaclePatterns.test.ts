import { describe, expect, it } from "vitest";
import { INPUT, PLAYER, RUN } from "../game/Constants";
import { ProgressionSystem } from "./ProgressionSystem";
import { SpawnSystem, type SpawnRequest } from "./SpawnSystemOwner";

type ObstacleRequest = Extract<SpawnRequest, { type: "obstacle" }>;

function sample(seed: number, fps: number, jumpLevel: number, accelerating = false) {
  const effects = ProgressionSystem.effectsFor({ jump: jumpLevel, speed: 5, magnet: 0, dash: 0 });
  const spawn = new SpawnSystem(seed);
  spawn.reset(seed, effects.jumpImpulseMultiplier);
  const obstacles: Array<{ at: number; distance: number; speed: number; request: ObstacleRequest }> = [];
  const pickups: Array<{ at: number; request: SpawnRequest }> = [];
  let distance = 0;
  for (let frame = 1; frame <= 120 * fps; frame += 1) {
    const at = frame / fps;
    const speed = (accelerating ? Math.min(RUN.maxSpeed, RUN.initialSpeed + at * RUN.speedAcceleration) : RUN.maxSpeed)
      * effects.worldSpeedMultiplier;
    distance += speed / fps;
    for (const request of spawn.update(1 / fps, speed)) {
      if (request.type === "obstacle") obstacles.push({ at, distance, speed, request });
      else pickups.push({ at, request });
    }
  }
  return { obstacles, pickups, effects };
}

describe("obstacle rhythm", () => {
  it("opens with three separate ground hazards, then introduces complete pairs and triples", () => {
    const { obstacles } = sample(78, 60, 0);
    expect(obstacles.slice(0, 3).every(item => item.request.pattern.length === 1
      && ["Rock", "Pumpkin", "Puddle", "WoodFence"].includes(item.request.definition.kind))).toBe(true);
    expect(obstacles.some(item => item.request.pattern.length === 2)).toBe(true);
    expect(obstacles.some(item => item.request.pattern.length === 3)).toBe(true);
    let previous: ObstacleRequest | undefined;
    for (let index = 0; index < obstacles.length - 3; index += 1) {
      const current = obstacles[index]!.request;
      if (current.pattern.index === 0) {
        if (previous) expect(current.pattern.id).not.toBe(previous.pattern.id);
        for (let offset = 0; offset < current.pattern.length; offset += 1) {
          expect(obstacles[index + offset]!.request.pattern).toEqual({
            id: current.pattern.id, index: offset, length: current.pattern.length,
          });
        }
      }
      if (current.pattern.length === 3) expect(index).toBeGreaterThanOrEqual(12);
      previous = current;
    }
  });

  it.each([30, 60, 120])("reserves a complete high-jump cycle and a longer break between groups at %s Hz", fps => {
    for (const accelerating of [false, true]) for (const jumpLevel of [0, 5]) for (const seed of [1, 42, 78]) {
      const { obstacles, effects } = sample(seed, fps, jumpLevel, accelerating);
      const flight = 2 * Math.abs(PLAYER.highJumpVelocityY) * effects.jumpImpulseMultiplier / PLAYER.gravityY;
      const recovery = Math.max(INPUT.crouchDurationMs / 1000, flight + RUN.simulationDeltaCapMs / 1000)
        + INPUT.jumpBufferMs / 1000;
      for (let index = 1; index < obstacles.length; index += 1) {
        const previous = obstacles[index - 1]!, current = obstacles[index]!;
        const gap = current.distance - previous.distance - previous.request.definition.width;
        const clearSeconds = (gap - (PLAYER.width - 12)) / current.speed;
        const betweenGroups = current.request.pattern.index === 0;
        expect(clearSeconds).toBeGreaterThanOrEqual(recovery - 0.00001);
        if (betweenGroups) expect(clearSeconds).toBeGreaterThanOrEqual(recovery + 0.65 - 0.00001);
        expect(gap).toBeGreaterThanOrEqual(RUN.minimumJumpDistance);
        expect(gap).toBeGreaterThanOrEqual(current.speed * RUN.minimumReactionTime);
      }
    }
  });

  it("keeps stars and power-ups independent of the changed obstacle cadence", () => {
    const base = sample(42, 60, 0), upgraded = sample(42, 60, 5);
    expect(base.obstacles).not.toEqual(upgraded.obstacles);
    expect(base.pickups).toEqual(upgraded.pickups);
  });

  it("resets a partially emitted combination, its seed and opening delay between runs", () => {
    const spawn = new SpawnSystem(42);
    const collect = () => {
      const results: SpawnRequest[] = [];
      for (let frame = 0; frame < 1200; frame += 1) results.push(...spawn.update(1 / 60, RUN.maxSpeed));
      return results;
    };
    const original = collect();
    spawn.reset(42);
    expect(collect()).toEqual(original);
    spawn.reset(42);
    expect(spawn.update(RUN.safeSpawnWindow - 0.01, RUN.maxSpeed).some(item => item.type === "obstacle")).toBe(false);
    expect(spawn.update(0.010001, RUN.maxSpeed).filter(item => item.type === "obstacle")).toHaveLength(1);
  });

  it("does not advance while paused or given an invalid step", () => {
    const spawn = new SpawnSystem(78), control = new SpawnSystem(78);
    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(spawn.update(delta, 390)).toEqual([]);
    for (const speed of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(spawn.update(0.04, speed)).toEqual([]);
    for (let frame = 0; frame < 1500; frame += 1) expect(spawn.update(0.04, 390)).toEqual(control.update(0.04, 390));
  });

  it("finishes a queued high-duck pair when speed falls to the initial speed", () => {
    const spawn = new SpawnSystem(78);
    let queued = false;
    for (let frame = 0; frame < 20_000; frame += 1) {
      for (const request of spawn.update(0.04, 390)) {
        if (request.type === "obstacle" && request.pattern.id === "high-duck" && request.pattern.index === 0) queued = true;
      }
      if (queued) break;
    }
    expect(queued).toBe(true);
    let next: ObstacleRequest | undefined;
    for (let frame = 0; frame < 1000 && !next; frame += 1) {
      next = spawn.update(0.04, RUN.initialSpeed).find((request): request is ObstacleRequest => request.type === "obstacle");
    }
    expect(next?.definition.kind).toBe("HangingVine");
    expect(next?.pattern).toEqual({ id: "high-duck", index: 1, length: 2 });
  });
});
