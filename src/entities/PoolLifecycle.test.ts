import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    width = 0;
    height = 0;
    scaleX = 1;
    scaleY = 1;
    active = true;
    visible = true;
    angle = 0;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setOrigin(): this { return this; }
    setDisplaySize(width: number, height: number): this {
      this.width = width;
      this.height = height;
      return this;
    }
    setDepth(): this { return this; }
    setActive(active: boolean): this { this.active = active; return this; }
    setVisible(visible: boolean): this { this.visible = visible; return this; }
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setScale(scale: number): this { this.scaleX = scale; this.scaleY = scale; return this; }
    setAngle(angle: number): this { this.angle = angle; return this; }
  }

  return { default: { Physics: { Arcade: { Sprite } } } };
});

import { Obstacle } from "./Obstacle";
import { Star } from "./Star";
import { Pumpkin } from "../game/ObstacleDefinitions";
import { POWER_UP } from "../game/Constants";

type BodyProbe = {
  enable: boolean;
  velocityX: number;
  setAllowGravity: ReturnType<typeof vi.fn>;
  setImmovable: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setOffset: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  setVelocity: ReturnType<typeof vi.fn>;
  setVelocityX: (value: number) => void;
  stop: ReturnType<typeof vi.fn>;
};

function sceneWithBody(): { scene: object; body: BodyProbe } {
  const body: BodyProbe = {
    enable: true,
    velocityX: 0,
    setAllowGravity: vi.fn(),
    setImmovable: vi.fn(),
    setSize: vi.fn(),
    setOffset: vi.fn(),
    reset: vi.fn(),
    setVelocity: vi.fn(),
    setVelocityX(value) { this.velocityX = value; },
    stop: vi.fn(),
  };
  return {
    body,
    scene: {
      add: { existing: vi.fn() },
      physics: { add: { existing: (object: { body?: unknown }) => { object.body = body; } } },
    },
  };
}

function bodyOf(object: object): BodyProbe {
  return (object as { body: BodyProbe }).body;
}

describe("pooled gameplay entity lifecycle", () => {
  it("deactivates and resets an obstacle before reuse", () => {
    const { scene, body } = sceneWithBody();
    const obstacle = new Obstacle(scene as never, 498, Pumpkin, 0.5);
    obstacle.passed = true;
    obstacle.deactivate();

    expect(obstacle.active).toBe(false);
    expect(obstacle.visible).toBe(false);
    expect(body.enable).toBe(false);
    expect(body.stop).toHaveBeenCalledOnce();

    obstacle.activate(498, 1.25, 270);
    expect(obstacle.active).toBe(true);
    expect(obstacle.visible).toBe(true);
    expect(obstacle.passed).toBe(false);
    expect(body.enable).toBe(true);
    expect(body.reset).toHaveBeenCalledWith(498, 218);
    expect(body.velocityX).toBe(-270);
  });

  it("attracts nearby stars toward the sheep while Magnet is active", () => {
    const { scene, body } = sceneWithBody();
    const star = new Star(scene as never, 150, 120, 0.2);

    star.updateMotion(0.016, 190, { x: 100, y: 118 });

    expect(POWER_UP.magnetRadiusPx).toBeGreaterThan(50);
    expect(body.setVelocity).toHaveBeenCalledOnce();
    const [velocityX, velocityY] = body.setVelocity.mock.calls[0]!;
    expect(velocityX).toBeLessThan(0);
    expect(velocityY).toBeLessThan(0);
  });
});
