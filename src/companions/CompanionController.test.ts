import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { Obstacle } from "../entities/Obstacle";
import { WoodFence } from "../game/ObstacleDefinitions";
import { CompanionController } from "./CompanionController";

class Display {
  active = true; visible = true; name = ""; x = 0; y = 0; width = 32; height = 32; displayWidth = 0; displayHeight = 0;
  data = new Map<string, unknown>(); anims = { currentAnim: null as { key: string } | null };
  frame = { name: 1 };
  constructor(x: number, y: number) { this.x = x; this.y = y; }
  setOrigin() { return this; } setDepth() { return this; } setAngle() { return this; } setAlpha() { return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setScale(value: number) { this.displayWidth = this.width * value; this.displayHeight = this.height * value; return this; }
  setName(name: string) { this.name = name; return this; }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setDisplaySize(width: number, height: number) { this.displayWidth = width; this.displayHeight = height; return this; }
  play(key: string) { this.anims.currentAnim = { key }; return this; }
  destroy = vi.fn(() => { this.active = false; });
}
function setup() {
  const objects: Display[] = [], physics = vi.fn(() => { throw new Error("Companions must not create physics objects"); });
  const create = (x: number, y: number) => { const display = new Display(x, y); objects.push(display); return display; };
  const scene = { add: { image: create, sprite: create, ellipse: create, rectangle: create }, physics: { add: { sprite: physics, image: physics, existing: physics } } } as unknown as Phaser.Scene;
  const lead = Object.freeze({ x: 101, y: 218, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" as const,
    body: Object.freeze({ x: 86, y: 188, width: 30, height: 30 }) });
  const unlockedSkins = vi.fn(() => ["white"]), playBell = vi.fn(), onSummoned = vi.fn();
  const controller = new CompanionController(scene, { lead, leadSkin: "white", unlockedSkins, playBell, onSummoned, jumpImpulseMultiplier: 1, reducedMotion: false, seed: 42 });
  const obstacle = { x: 204, rightEdge: 240, active: true, definition: WoodFence } as Obstacle;
  controller.observeObstacleSpawn({ type: "obstacle", definition: WoodFence, phase: 0, pattern: { id: "single", index: 0, length: 1 } }, obstacle);
  const update = (nowMs: number, deltaSeconds = .02, pickups: { x: number; y: number; width: number; height: number }[] = []) => controller.update({ nowMs, deltaSeconds, speed: 190, viewport: { width: 480, height: 270 }, obstacles: [obstacle], pickups });
  const live = (name: string) => objects.filter(item => item.active && item.name === name);
  return { controller, objects, physics, lead, unlockedSkins, playBell, onSummoned, update, live };
}
describe("display-only companion lifecycle", () => {
  it("waits for eligibility and safe gap, creates one bell, then reads the current unlocks on collection once", () => {
    const { update, live, unlockedSkins, playBell, onSummoned, physics, controller } = setup();
    update(24_999); expect(live("companion-bell-pickup")).toHaveLength(0);
    update(25_000, .02, [{ x: 480, y: 184, width: 24, height: 24 }]);
    expect(live("companion-bell-pickup")).toHaveLength(0);
    update(25_001); expect(live("companion-bell-pickup")).toHaveLength(1);
    expect(unlockedSkins).not.toHaveBeenCalled();
    unlockedSkins.mockReturnValue(["white", "mint", "invalid"]);
    for (let frame = 1; frame <= 110; frame++) update(25_001 + frame * 20);
    expect(live("companion-bell-pickup")).toHaveLength(0); expect(live("companion-sheep")).toHaveLength(1);
    expect(live("companion-sheep")[0]!.data.get("skin")).toBe("mint");
    expect(live("companion-neck-bell")).toHaveLength(1);
    expect(unlockedSkins).toHaveBeenCalledOnce(); expect(playBell).toHaveBeenCalledOnce(); expect(physics).not.toHaveBeenCalled();
    expect(onSummoned).toHaveBeenCalledOnce();
    expect(onSummoned).toHaveBeenCalledWith("mint");
    update(29_000); expect(live("companion-sheep")).toHaveLength(1); expect(playBell).toHaveBeenCalledOnce();
    expect(onSummoned).toHaveBeenCalledOnce();
    controller.clear(); expect(live("companion-sheep")).toHaveLength(0);
  });
  it("recycles a missed bell beyond the viewport without replacement or reward", () => {
    const { update, live, controller, playBell } = setup();
    // Simulate the observed recycled position; no main-character state is changed.
    update(25_000); live("companion-bell-pickup")[0]!.setPosition(-42, 199);
    update(28_000); expect(live("companion-bell-pickup")).toHaveLength(0);
    expect(controller.scheduler.state).toBe("waiting"); expect(controller.scheduler.nextEligibleAtMs).toBeGreaterThanOrEqual(63_000);
    expect(playBell).not.toHaveBeenCalled(); update(28_020); expect(live("companion-bell-pickup")).toHaveLength(0);
  });
  it("freezes presentation on paused time and cleans all objects once on failure/exit", () => {
    const { update, live, controller, objects } = setup();
    update(25_000); live("companion-bell-pickup")[0]!.setPosition(101, 199); update(25_020, 0);
    update(26_020); const sheep = live("companion-sheep")[0]!, paused = { x: sheep.x, y: sheep.y };
    for (let frame = 0; frame < 100; frame++) update(26_020, 0);
    expect({ x: sheep.x, y: sheep.y }).toEqual(paused);
    controller.clear(); controller.clear(); update(90_000);
    expect(objects.filter(item => item.active)).toHaveLength(0);
    for (const item of objects) expect(item.destroy).toHaveBeenCalledOnce();
    expect(controller.scheduler.state).toBe("stopped");
    const next = setup(); next.update(0); expect(next.objects).toHaveLength(0);
  });
  it("keeps the white fallback visibly distinct and starts cooldown only after full departure", () => {
    const { update, live, controller, lead, playBell } = setup();
    update(25_000); live("companion-bell-pickup")[0]!.setPosition(101, 199); update(25_020, 0);
    expect(live("companion-sheep")[0]!.data.get("skin")).toBe("white");
    update(26_020); const sheep = live("companion-sheep")[0]!;
    expect(sheep.displayWidth).toBe(lead.displayWidth * .85);
    expect(sheep.x + sheep.displayWidth / 2).toBeLessThan(lead.x - lead.displayWidth / 2);
    update(34_020); expect(live("companion-sheep")[0]!.data.get("phase")).toBe("leaving");
    expect(controller.scheduler.state).toBe("companion");
    update(35_020); expect(live("companion-sheep")).toHaveLength(0);
    expect(controller.scheduler.nextEligibleAtMs).toBeGreaterThanOrEqual(70_020);
    expect(controller.scheduler.nextEligibleAtMs).toBeLessThanOrEqual(85_020);
    expect(playBell).toHaveBeenCalledOnce();
  });
  it("defers one run-record crown until an actual companion follows, prioritizes farewell and clears every icon", () => {
    const { controller, update, live, objects } = setup();
    controller.notifyRecord(); controller.notifyRecord(); controller.notifyStarGroup();
    expect(objects).toHaveLength(0);
    update(25_000); live("companion-bell-pickup")[0]!.setPosition(101, 199); update(25_020, 0);
    expect(live("companion-response-crown")[0]!.visible).toBe(false);
    update(26_020); expect(live("companion-sheep")[0]!.data.get("response")).toBe("crown");
    expect(live("companion-response-crown")[0]!.visible).toBe(true);
    controller.notifyRecord(); update(27_200); expect(live("companion-response-crown")[0]!.visible).toBe(false);
    update(28_801); expect(live("companion-sheep")[0]!.data.get("response")).toBeNull();
    controller.notifyStarGroup(); update(28_820);
    expect(live("companion-response-star")[0]!.visible).toBe(true);
    update(34_020); expect(live("companion-sheep")[0]!.data.get("response")).toBe("heart");
    expect(live("companion-response-star")[0]!.visible).toBe(false);
    expect(live("companion-response-heart")[0]!.visible).toBe(true);
    controller.notifyRecord(); controller.notifyStarGroup(); controller.clear(); controller.clear(); update(99_000);
    expect(objects.filter(item => item.active)).toHaveLength(0);
    for (const item of objects) expect(item.destroy).toHaveBeenCalledOnce();
  });
});
