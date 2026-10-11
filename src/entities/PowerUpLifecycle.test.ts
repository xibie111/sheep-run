import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Sprite {
    x: number;
    y: number;
    active = true;
    visible = true;
    texture = "";
    constructor(_scene: unknown, x: number, y: number, texture: string) { this.x = x; this.y = y; this.texture = texture; }
    setDepth(): this { return this; }
    setDisplaySize(): this { return this; }
    setActive(value: boolean): this { this.active = value; return this; }
    setVisible(value: boolean): this { this.visible = value; return this; }
    setTexture(value: string): this { this.texture = value; return this; }
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setAngle(): this { return this; }
  }
  return { default: { Physics: { Arcade: { Sprite } } } };
});

import { PowerUp } from "./PowerUp";
import type { PowerUpType } from "../systems/PowerUpSystem";

type BodyProbe = {
  enable: boolean;
  velocityX: number;
  setAllowGravity: ReturnType<typeof vi.fn>;
  setImmovable: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVelocityX: (value: number) => void;
};

function sceneWithBody(): { scene: object; body: BodyProbe } {
  const body: BodyProbe = {
    enable: true,
    velocityX: 0,
    setAllowGravity: vi.fn(),
    setImmovable: vi.fn(),
    setSize: vi.fn(),
    reset: vi.fn(),
    stop: vi.fn(),
    setVelocityX(value) { this.velocityX = value; },
  };
  return {
    body,
    scene: {
      add: { existing: vi.fn() },
      physics: { add: { existing: (object: { body?: unknown }) => { object.body = body; } } },
    },
  };
}

describe("pooled PowerUp entity lifecycle", () => {
  it("disables collected bodies and restores clean type, position and motion on reuse", () => {
    const { scene, body } = sceneWithBody();
    const powerUp = new PowerUp(scene as never, 494, 140, "magnet", 0.2);
    powerUp.collected = true;
    powerUp.deactivate();

    expect(powerUp.active).toBe(false);
    expect(powerUp.visible).toBe(false);
    expect(body.enable).toBe(false);
    expect(body.stop).toHaveBeenCalledOnce();

    powerUp.activate(494, 125, "shield" satisfies PowerUpType, 1.1, 270);
    expect(powerUp.active).toBe(true);
    expect(powerUp.visible).toBe(true);
    expect(powerUp.texture).toBe("powerup-shield");
    expect(powerUp.type).toBe("shield");
    expect(powerUp.collected).toBe(false);
    expect(body.enable).toBe(true);
    expect(body.reset).toHaveBeenCalledWith(494, 125);
    expect(body.velocityX).toBe(-270);
  });
});
