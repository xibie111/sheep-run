import { describe, expect, it } from "vitest";
import { INPUT, PLAYER, RUN, WORLD } from "./Constants";
import {
  EXPANDED_OBSTACLE_DEFINITIONS, FlyingBird, FlyingGoose, HangingLantern,
  HayCart, OBSTACLE_DEFINITIONS, WaterTrough, type ObstacleDefinition,
} from "./ObstacleDefinitions";
import { availableObstaclePatterns } from "../systems/ObstaclePatterns";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { SpawnSystem, type SpawnRequest } from "../systems/SpawnSystemOwner";

type ObstacleRequest = Extract<SpawnRequest, { type: "obstacle" }>;
const addedKinds = new Set(EXPANDED_OBSTACLE_DEFINITIONS.map(definition => definition.kind));

function collisionInterval(definition: ObstacleDefinition, verticalMotion = 0) {
  const top = WORLD.groundY - definition.groundOffset - definition.height
    + definition.hitbox.offsetY + verticalMotion;
  return { top, bottom: top + definition.hitbox.height };
}

function sample(seed: number, speed: number, jumpMultiplier = 1) {
  const spawn = new SpawnSystem(seed);
  spawn.reset(seed, jumpMultiplier);
  const obstacles: Array<{ distance: number; request: ObstacleRequest }> = [];
  let distance = 0;
  for (let frame = 0; frame < 180 * 60; frame += 1) {
    distance += speed / 60;
    for (const request of spawn.update(1 / 60, speed)) {
      if (request.type === "obstacle") obstacles.push({ distance, request });
    }
  }
  return obstacles;
}

describe("expanded farm hazards remain avoidable with the existing touch actions", () => {
  it.each([HayCart, WaterTrough])("gives an unupgraded normal jump more than 80 ms of timing margin over $kind", definition => {
    const rise = WORLD.groundY - collisionInterval(definition).top;
    const discriminant = PLAYER.jumpVelocityY ** 2 - 2 * PLAYER.gravityY * rise;
    expect(discriminant).toBeGreaterThan(0);
    // The parabola's two intersections with the obstacle top delimit the safe
    // airborne interval. Budget the full authored sheep width, not its narrower body.
    const airborneClearance = 2 * Math.sqrt(discriminant) / PLAYER.gravityY;
    const crossing = (PLAYER.width + definition.hitbox.width) / RUN.initialSpeed;
    expect(airborneClearance - crossing).toBeGreaterThan(0.08);
  });

  it("requires crouching under the lantern and leaves both headroom and action-time margin", () => {
    const { top, bottom } = collisionInterval(HangingLantern);
    const standingTop = WORLD.groundY - (PLAYER.height - 8);
    const crouchingTop = WORLD.groundY - PLAYER.crouchBodyHeight;
    expect(top).toBeLessThan(WORLD.groundY);
    expect(bottom).toBeGreaterThan(standingTop);
    expect(crouchingTop - bottom).toBeGreaterThanOrEqual(4);
    const crossing = (PLAYER.width - 12 + HangingLantern.hitbox.width) / RUN.initialSpeed;
    expect(INPUT.crouchDurationMs / 1000 - crossing).toBeGreaterThan(0.05);
  });

  it("keeps every goose phase above a grounded sheep while allowing an ordinary jump to hit it", () => {
    expect(FlyingGoose.motion).toBeDefined();
    const amplitude = FlyingGoose.motion!.amplitude;
    const groundedTop = WORLD.groundY - (PLAYER.height - 8);
    const lowestGoose = collisionInterval(FlyingGoose, amplitude);
    expect(groundedTop - lowestGoose.bottom).toBeGreaterThanOrEqual(20);

    // At 120 ms into a real, unupgraded normal jump, the sheep's body spans
    // every possible goose position. It is an airborne hazard, not a cosmetic bird.
    const seconds = 0.12;
    const feet = WORLD.groundY + PLAYER.jumpVelocityY * seconds + PLAYER.gravityY * seconds ** 2 / 2;
    const head = feet - (PLAYER.height - 8);
    const highestGoose = collisionInterval(FlyingGoose, -amplitude);
    expect(head).toBeLessThan(highestGoose.top);
    expect(feet).toBeGreaterThan(lowestGoose.bottom);
    expect(FlyingGoose.motion).not.toEqual(FlyingBird.motion);
    expect(FlyingGoose.groundOffset).not.toBe(FlyingBird.groundOffset);
  });

  it("preserves the three-hazard teaching phase and exposes every addition in ordinary flow", () => {
    expect(addedKinds).toEqual(new Set(["HayCart", "WaterTrough", "HangingLantern", "FlyingGoose"]));
    for (const count of [0, 1, 2]) {
      const patterns = availableObstaclePatterns(count);
      expect(patterns.map(pattern => pattern.id)).toEqual([
        "opening-rock", "opening-pumpkin", "opening-puddle", "opening-fence",
      ]);
      expect(patterns.every(pattern => pattern.obstacles.length === 1
        && pattern.obstacles[0]!.groundOffset === 0)).toBe(true);
    }
    const flowKinds = new Set(availableObstaclePatterns(3).flatMap(pattern => pattern.obstacles.map(definition => definition.kind)));
    for (const kind of addedKinds) expect(flowKinds.has(kind)).toBe(true);
    expect(new Set(OBSTACLE_DEFINITIONS.map(definition => definition.kind)).size).toBe(OBSTACLE_DEFINITIONS.length);
    for (const definition of EXPANDED_OBSTACLE_DEFINITIONS) {
      expect(OBSTACLE_DEFINITIONS).toContain(definition);
      expect(definition.hitbox.offsetX).toBeGreaterThanOrEqual(0);
      expect(definition.hitbox.offsetY).toBeGreaterThanOrEqual(0);
      expect(definition.hitbox.offsetX + definition.hitbox.width).toBeLessThanOrEqual(definition.width);
      expect(definition.hitbox.offsetY + definition.hitbox.height).toBeLessThanOrEqual(definition.height);
    }
  });

  it.each([RUN.initialSpeed, RUN.maxSpeed])("actually emits every new type with legal action recovery at %s px/s", speed => {
    for (const jumpLevel of [0, 5]) {
      const effects = ProgressionSystem.effectsFor({ jump: jumpLevel, speed: 0, magnet: 0, dash: 0 });
      const highJumpCycle = 2 * Math.abs(PLAYER.highJumpVelocityY) * effects.jumpImpulseMultiplier / PLAYER.gravityY;
      const actionRecovery = Math.max(INPUT.crouchDurationMs / 1000, highJumpCycle + RUN.simulationDeltaCapMs / 1000)
        + INPUT.jumpBufferMs / 1000;
      const emittedKinds = new Set<string>();
      let adjacentPairs = 0;
      for (const seed of [1, 42, 78]) {
        const obstacles = sample(seed, speed, effects.jumpImpulseMultiplier);
        expect(obstacles.slice(0, 3).every(item => item.request.pattern.length === 1
          && ["Rock", "Pumpkin", "Puddle", "WoodFence"].includes(item.request.definition.kind))).toBe(true);
        for (const item of obstacles) emittedKinds.add(item.request.definition.kind);
        for (let index = 1; index < obstacles.length; index += 1) {
          const previous = obstacles[index - 1]!, current = obstacles[index]!;
          if (!addedKinds.has(previous.request.definition.kind) && !addedKinds.has(current.request.definition.kind)) continue;
          adjacentPairs += 1;
          // Compare actual spawn travel with the previous rear edge, rather than
          // re-running the generator's gap function and asserting it equals itself.
          const clearGap = current.distance - previous.distance - previous.request.definition.width;
          const bodyClearSeconds = (clearGap - (PLAYER.width - 12)) / speed;
          expect(bodyClearSeconds).toBeGreaterThanOrEqual(actionRecovery - 0.00001);
          if (current.request.pattern.index === 0) {
            expect(bodyClearSeconds).toBeGreaterThanOrEqual(actionRecovery + 0.65 - 0.00001);
          }
          expect(clearGap).toBeGreaterThanOrEqual(RUN.minimumJumpDistance);
          expect(clearGap).toBeGreaterThanOrEqual(speed * RUN.minimumReactionTime);
        }
      }
      expect(adjacentPairs).toBeGreaterThan(0);
      for (const kind of addedKinds) expect(emittedKinds.has(kind)).toBe(true);
    }
  });
});
