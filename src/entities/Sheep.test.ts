import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    frame = { width: 24, height: 21 };
    scaleX = 1;
    scaleY = 1;
    body: unknown;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setOrigin(): this { return this; }
    setDisplaySize(width: number, height: number): this {
      this.scaleX = width / this.frame.width;
      this.scaleY = height / this.frame.height;
      return this;
    }
    setDepth(): this { return this; }
  }
  return { default: { Physics: { Arcade: { Sprite } } } };
});

import { Sheep } from "./Sheep";

type MockBody = {
  velocity: { y: number };
  blocked: { down: boolean };
  touching: { down: boolean };
  setCollideWorldBounds: () => void;
  setBounce: () => void;
  setVelocityY: (velocity: number) => void;
  setSize: (width: number, height: number) => void;
  setOffset: (x: number, y: number) => void;
  updateFromGameObject: () => void;
  position: { x: number; y: number };
  prevFrame: { x: number; y: number };
};

function makeSheep(jumpImpulseMultiplier = 1): { sheep: Sheep; body: MockBody } {
  const body: MockBody = {
    velocity: { y: 0 },
    blocked: { down: true },
    touching: { down: true },
    setCollideWorldBounds: vi.fn(),
    setBounce: vi.fn(),
    setVelocityY(velocity) { this.velocity.y = velocity; },
    setSize: vi.fn(),
    setOffset: vi.fn(),
    updateFromGameObject: vi.fn(),
    position: { x: 0, y: 0 },
    prevFrame: { x: 0, y: 0 },
  };
  const scene = {
    add: { existing: vi.fn() },
    physics: { add: { existing: (sprite: { body: unknown }) => { sprite.body = body; } } },
  };
  return { sheep: new Sheep(scene as never, jumpImpulseMultiplier), body };
}

describe("Sheep jump impulses", () => {
  it("applies the normal jump velocity", () => {
    const { sheep, body } = makeSheep();

    expect(sheep.applyJump("normal")).toBe(true);
    expect(body.velocity.y).toBe(-500);
  });

  it("applies the high-jump velocity", () => {
    const { sheep, body } = makeSheep();

    expect(sheep.applyJump("high")).toBe(true);
    expect(body.velocity.y).toBe(-580);
  });

  it("limits a fully upgraded high jump without removing the saved normal-jump bonus", () => {
    const { sheep, body } = makeSheep(1.15);
    expect(sheep.applyJump("high")).toBe(true);
    expect(body.velocity.y).toBe(-590);
    expect(sheep.applyJump("normal")).toBe(true);
    expect(body.velocity.y).toBe(-575);
  });

  it("applies the saved impulse multiplier to normal jumps", () => {
    const { sheep, body } = makeSheep(1.15);

    expect(sheep.applyJump("normal")).toBe(true);
    expect(body.velocity.y).toBe(-575);
  });
});
