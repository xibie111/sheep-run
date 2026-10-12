import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Sprite {
    x: number;
    y: number;
    angle = 0;
    active = true;
    visible = true;
    body = {
      velocityCalls: [] as Array<[number, number]>,
      velocityXCalls: [] as number[],
      setAllowGravity: (_enabled: boolean) => undefined,
      setImmovable: (_enabled: boolean) => undefined,
      setSize: (_width: number, _height: number, _center?: boolean) => undefined,
      setVelocity: (x: number, y: number) => { this.body.velocityCalls.push([x, y]); },
      setVelocityX: (x: number) => { this.body.velocityXCalls.push(x); },
      enable: true,
      reset: (_x: number, _y: number) => undefined,
    };

    constructor(_scene: unknown, x: number, y: number) {
      this.x = x;
      this.y = y;
    }

    setDepth(_depth: number): this { return this; }
    setScale(_scale: number): this { return this; }
    setAngle(angle: number): this { this.angle = angle; return this; }
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setActive(active: boolean): this { this.active = active; return this; }
    setVisible(visible: boolean): this { this.visible = visible; return this; }
  }

  return { default: { Physics: { Arcade: { Sprite } } } };
});

import { Star } from "./Star";

describe("Star magnet radius", () => {
  const scene = { add: { existing: (_item: unknown) => undefined }, physics: { add: { existing: (_item: unknown) => undefined } } };
  it("lets a missed star scroll away without being pulled back by the magnet", () => {
    const star = new Star(scene as never, 75, 100, 0);
    star.missed = true;
    star.updateMotion(0.04, 190, { x: 80, y: 100, radiusPx: 110 });
    const body = star.body as unknown as { velocityCalls: number[][]; velocityXCalls: number[] };
    expect(body.velocityCalls).toEqual([[-190, 0]]);
    expect(body.velocityXCalls).toEqual([]);
  });
  it("clears the missed marker when a pooled star is activated again", () => {
    const star = new Star(scene as never, 75, 100, 0);
    star.missed = true;
    star.collected = true;
    star.activate(494, 100, 0, 190);
    expect(star.missed).toBe(false);
    expect(star.collected).toBe(false);
  });
  it("uses the progression radius for attraction instead of the base radius", () => {
    const scene = { add: { existing: (_item: unknown) => undefined }, physics: { add: { existing: (_item: unknown) => undefined } } };
    const star = new Star(scene as never, 100, 100, 0);
    const body = (star as unknown as { body: { velocityCalls: Array<[number, number]>; velocityXCalls: number[] } }).body;
    const updateWithRadius = star.updateMotion as unknown as (
      deltaSeconds: number,
      speed: number,
      magnetTarget: { x: number; y: number; radiusPx: number },
    ) => void;

    updateWithRadius.call(star, 0, 190, { x: 40, y: 100, radiusPx: 40 });
    expect(body.velocityCalls).toEqual([]);
    expect(body.velocityXCalls).toEqual([-190]);

    updateWithRadius.call(star, 0, 190, { x: 40, y: 100, radiusPx: 60 });
    expect(body.velocityCalls).toEqual([[-285, 0]]);
  });
});
