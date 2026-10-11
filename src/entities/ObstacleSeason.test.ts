import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Sprite {
    frame = { width: 36, height: 36 };
    scaleX = 1;
    scaleY = 1;
    originX = 0.5;
    originY = 0.5;
    texture = "";
    active = true;
    visible = true;
    data: Record<string, unknown> = {};
    body = {
      sourceWidth: 0, sourceHeight: 0, offsetX: 0, offsetY: 0, enable: true, velocityX: 0,
      setAllowGravity: vi.fn(), setImmovable: vi.fn(), stop: vi.fn(),
      setSize(width: number, height: number) { this.sourceWidth = width; this.sourceHeight = height; },
      setOffset(x: number, y: number) { this.offsetX = x; this.offsetY = y; },
      reset: (x: number, y: number) => { this.x = x; this.y = y; },
      setVelocityX(value: number) { this.velocityX = value; },
    };
    constructor(public scene: unknown, public x: number, public y: number) {}
    setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; }
    setDepth() { return this; }
    setTexture(key: string) { this.texture = key; this.frame = { width: 144, height: 144 }; return this; }
    setDisplaySize(width: number, height: number) { this.scaleX = width / this.frame.width; this.scaleY = height / this.frame.height; return this; }
    get displayWidth() { return this.frame.width * this.scaleX; }
    get displayHeight() { return this.frame.height * this.scaleY; }
    setActive(value: boolean) { this.active = value; return this; }
    setVisible(value: boolean) { this.visible = value; return this; }
    setData(key: string, value: unknown) { this.data[key] = value; return this; }
  }
  return { default: { Physics: { Arcade: { Sprite } } } };
});

import { Obstacle } from "./Obstacle";
import { OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { WORLD } from "../game/Constants";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { seasonObstacleKey } from "../data/seasonArtAssets";

describe("seasonal obstacle collision contract", () => {
  it.each(OBSTACLE_DEFINITIONS)("preserves $kind world geometry and motion through seasonal pool reuse", definition => {
    const scene = { textures: { exists: () => true }, add: { existing() {} }, physics: { add: { existing() {} } } };
    const obstacle = new Obstacle(scene as never, 498, definition, 0);
    const probe = obstacle as unknown as {
      texture: string; body: { sourceWidth: number; sourceHeight: number; offsetX: number; offsetY: number; velocityX: number; enable: boolean };
    };
    for (const season of SEASON_ORDER) {
      obstacle.passed = true;
      obstacle.deactivate();
      obstacle.activate(498, 0, 270, season);
      expect(probe.texture).toBe(seasonObstacleKey(season, definition.kind));
      expect(obstacle.visualSeason).toBe(season);
      expect(obstacle.y).toBe(WORLD.groundY - definition.groundOffset);
      expect(probe.body.sourceWidth * obstacle.scaleX).toBeCloseTo(definition.hitbox.width);
      expect(probe.body.sourceHeight * obstacle.scaleY).toBeCloseTo(definition.hitbox.height);
      const left = obstacle.x - obstacle.displayWidth * obstacle.originX;
      const top = obstacle.y - obstacle.displayHeight;
      expect(left + probe.body.offsetX * obstacle.scaleX).toBeCloseTo(obstacle.x + definition.hitbox.offsetX);
      expect(top + probe.body.offsetY * obstacle.scaleY).toBeCloseTo(obstacle.y - definition.height + definition.hitbox.offsetY);
      expect(obstacle.displayWidth).toBeCloseTo(definition.width * (definition.visualScale ?? 1));
      expect(obstacle.displayHeight).toBeCloseTo(definition.height * (definition.visualScale ?? 1));
      expect(obstacle.rightEdge).toBe(obstacle.x + definition.width);
      expect(probe.body.velocityX).toBe(-270);
      expect(probe.body.enable).toBe(true);
      expect(obstacle.passed).toBe(false);
      obstacle.moveAt(300, 0.25);
      expect(probe.body.velocityX).toBe(-300);
      const expectedY = WORLD.groundY - definition.groundOffset + (definition.motion ? Math.sin(0.25 * definition.motion.frequency) * definition.motion.amplitude : 0);
      expect(obstacle.y).toBeCloseTo(expectedY);
      expect(obstacle.visualSeason).toBe(season);
    }
  });

  it.each(OBSTACLE_DEFINITIONS)("also preserves $kind geometry with its constructor texture", definition => {
    const scene = { textures: { exists: () => false }, add: { existing() {} }, physics: { add: { existing() {} } } };
    const obstacle = new Obstacle(scene as never, 498, definition, 0);
    obstacle.activate(498, 0, 270, "winter");
    const body = obstacle.body as unknown as { sourceWidth: number; sourceHeight: number; offsetX: number; offsetY: number };
    expect(body.sourceWidth * obstacle.scaleX).toBeCloseTo(definition.hitbox.width);
    expect(body.sourceHeight * obstacle.scaleY).toBeCloseTo(definition.hitbox.height);
    expect(obstacle.x - obstacle.displayWidth * obstacle.originX + body.offsetX * obstacle.scaleX)
      .toBeCloseTo(498 + definition.hitbox.offsetX);
    expect(obstacle.y - obstacle.displayHeight + body.offsetY * obstacle.scaleY)
      .toBeCloseTo(WORLD.groundY - definition.groundOffset - definition.height + definition.hitbox.offsetY);
    expect(obstacle.rightEdge).toBe(498 + definition.width);
  });
});
