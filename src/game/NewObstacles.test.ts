import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INPUT, PLAYER, RUN, WORLD } from "./Constants";
import { NEW_OBSTACLE_DEFINITIONS, HangingBranch, OBSTACLE_DEFINITIONS } from "./ObstacleDefinitions";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { SEASON_OBSTACLE_NAMES } from "../data/seasonArtAssets";
import { availableObstaclePatterns } from "../systems/ObstaclePatterns";
import frames from "../../assets/seasons/new-obstacles-v2/frames.json";

describe("new four-season farm hazards", () => {
  it.each(NEW_OBSTACLE_DEFINITIONS.filter(d => d.groundOffset === 0))("leaves normal-jump clearance for $kind without upgrades even at minimum speed", definition => {
    const rise = definition.height - definition.hitbox.offsetY;
    const clear = 2 * Math.sqrt(PLAYER.jumpVelocityY ** 2 - 2 * PLAYER.gravityY * rise) / PLAYER.gravityY;
    const crossing = (PLAYER.width + definition.hitbox.width) / RUN.initialSpeed;
    expect(clear - crossing).toBeGreaterThan(0.1);
    expect(definition.hitbox.offsetX).toBeGreaterThanOrEqual(0);
    expect(definition.hitbox.offsetX + definition.hitbox.width).toBeLessThanOrEqual(definition.width);
    expect(definition.hitbox.offsetY + definition.hitbox.height).toBeLessThanOrEqual(definition.height);
  });
  it("lets an ordinary crouch pass the hanging branch but blocks a standing sheep", () => {
    const bottom = WORLD.groundY - HangingBranch.groundOffset - HangingBranch.height + HangingBranch.hitbox.offsetY + HangingBranch.hitbox.height;
    expect(bottom).toBeGreaterThan(WORLD.groundY - (PLAYER.height - 8));
    expect(bottom).toBeLessThan(WORLD.groundY - PLAYER.crouchBodyHeight);
    expect(INPUT.crouchDurationMs / 1000 - (PLAYER.width - 12 + HangingBranch.hitbox.width) / RUN.initialSpeed).toBeGreaterThan(0.05);
  });
  it("keeps the opening hazards intact and makes all six additions reachable in normal flow", () => {
    expect(availableObstaclePatterns(0).map(p => p.id)).toEqual(["opening-rock", "opening-pumpkin", "opening-puddle", "opening-fence"]);
    const flow = new Set(availableObstaclePatterns(3).flatMap(p => p.obstacles.map(d => d.kind)));
    for (const definition of NEW_OBSTACLE_DEFINITIONS) expect(flow.has(definition.kind)).toBe(true);
    expect(new Set(OBSTACLE_DEFINITIONS.map(d => d.kind)).size).toBe(OBSTACLE_DEFINITIONS.length);
  });
  it("has exactly 24 distinct in-bounds sprites and seasonal names in the shipped PNG", () => {
    const png = readFileSync(new URL("../../assets/seasons/new-obstacles-v2/runtime/new-obstacles-atlas.png", import.meta.url));
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const season of SEASON_ORDER) {
      expect(Object.keys(frames[season]).sort()).toEqual(NEW_OBSTACLE_DEFINITIONS.map(d => d.kind).sort());
      for (const definition of NEW_OBSTACLE_DEFINITIONS) {
        const rect = frames[season][definition.kind as keyof typeof frames.spring];
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        expect(rect.width * rect.height).toBeGreaterThan(0);
        expect(SEASON_OBSTACLE_NAMES[season][definition.kind]).toBeTruthy();
        expect(rects.some(r => r.x < rect.x + rect.width && rect.x < r.x + r.width && r.y < rect.y + rect.height && rect.y < r.y + r.height)).toBe(false);
        rects.push(rect);
      }
    }
    expect(rects).toHaveLength(24);
  });
});
