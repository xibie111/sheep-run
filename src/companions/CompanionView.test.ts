import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { WORLD } from "../game/Constants";
import { CompanionView } from "./CompanionView";

class Display {
  active = true; visible = true; name = ""; x = 0; y = 0; width = 24; height = 16;
  displayWidth = 24; displayHeight = 16; angle = 0;
  data = new Map<string, unknown>(); frame = { name: 1 }; anims = { currentAnim: null as { key: string } | null };
  constructor(x: number, y: number, readonly key?: string) { this.x = x; this.y = y; }
  setOrigin() { return this; } setDepth() { return this; } setAlpha() { return this; }
  setAngle(angle: number) { this.angle = angle; return this; }
  setName(name: string) { this.name = name; return this; }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  setVisible(visible: boolean) { this.visible = visible; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setScale(scale: number) { this.displayWidth = this.width * scale; this.displayHeight = this.height * scale; return this; }
  setDisplaySize(width: number, height: number) { this.displayWidth = width; this.displayHeight = height; return this; }
  play(key: string) { this.anims.currentAnim = { key }; return this; }
  destroy = vi.fn(() => { this.active = false; });
}
function setup(reducedMotion = false) {
  const objects: Display[] = [];
  const create = (x: number, y: number, key?: string | number) => {
    const item = new Display(x, y, typeof key === "string" ? key : undefined); objects.push(item); return item;
  };
  const scene = { add: { sprite: create, image: create, ellipse: create, rectangle: create } } as unknown as Phaser.Scene;
  const view = new CompanionView(scene, "mint", 0, reducedMotion);
  const lead = Object.freeze({ x: 101, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" as const });
  const named = (name: string) => objects.find(item => item.name === name)!;
  return { view, lead, objects, named };
}

describe("generated companion response artwork presentation", () => {
  it("uses distinct preloaded art, preserves its aspect and adds happiness without changing the lead", () => {
    const { view, lead, named } = setup();
    const star = named("companion-response-star"), sheep = named("companion-sheep");
    expect(star.key).toBe("runner-v2-response-star");
    expect(star.displayWidth).toBe(12); expect(star.displayHeight).toBe(8);
    expect(named("companion-response-crown").key).toBe("runner-v2-response-crown");
    expect(named("companion-response-heart").key).toBe("runner-v2-response-heart");
    expect(star.visible).toBe(false);
    view.respond("star", 800); view.update(1000, lead, 0); view.update(1212.5, lead, 0);
    expect(star.visible).toBe(true); expect(sheep.angle).toBeCloseTo(3);
    expect(sheep.anims.currentAnim?.key).toBe("sheep-mint-run");
    expect(star.x).toBe(Math.round(sheep.x));
    expect(star.y + star.displayHeight / 2).toBeLessThan(sheep.y - sheep.displayHeight);
    expect(star.x + star.displayWidth / 2).toBeLessThan(lead.x - lead.displayWidth / 2);
    expect(lead).toEqual({ x: 101, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" });
  });
  it("hides celebratory icons for jumps and crouches while preserving original skin poses", () => {
    const { view, lead, named } = setup();
    view.respond("crown", 0); view.update(1000, lead, 0);
    const crown = named("companion-response-crown"), sheep = named("companion-sheep");
    expect(crown.visible).toBe(true);
    const jumping = Object.freeze({ ...lead, y: 160, motionState: "JUMPING" as const });
    view.update(1200, jumping, 0);
    expect(crown.visible).toBe(false); expect(sheep.y).toBe(160);
    expect(sheep.anims.currentAnim?.key).toBe("sheep-mint-jump"); expect(sheep.angle).toBe(0);
    const crouched = Object.freeze({ ...lead, displayHeight: 30 });
    view.update(1400, crouched, 0);
    expect(crown.visible).toBe(false); expect(sheep.displayHeight).toBe(30 * .85);
    view.update(1700, lead, 0); expect(crown.visible).toBe(true);
  });
  it("keeps static responses under reduced-motion preference and destroys all layers at ten seconds", () => {
    const { view, lead, objects, named } = setup(true);
    view.respond("star", 0); view.update(1000, lead, 0);
    const star = named("companion-response-star"), start = { x: star.x, y: star.y, angle: star.angle };
    view.update(1425, lead, 0);
    expect({ x: star.x, y: star.y, angle: star.angle }).toEqual(start);
    expect(named("companion-sheep").angle).toBe(0);
    view.update(9500, lead, 0);
    expect(named("companion-response-heart").visible).toBe(true);
    expect(named("companion-sheep").y).toBe(WORLD.groundY);
    expect(view.update(10_000, lead, 0)).toBe(true);
    view.respond("star", 11_000); view.destroy();
    expect(view.update(12_000, lead, 0)).toBe(true);
    for (const object of objects) { expect(object.active).toBe(false); expect(object.destroy).toHaveBeenCalledOnce(); }
  });
});
