import { afterEach, describe, expect, it, vi } from "vitest";
import { SHEEP_SKINS } from "../data/sheepSkins";
import { WORLD } from "../game/Constants";
import { SpawnSystem } from "../systems/SpawnSystemOwner";
import { BellScheduler } from "./BellScheduler";
import { isSafeBellGap, type BellGapContext } from "./BellGap";
import type { ObstacleKind } from "../game/ObstacleDefinitions";
import { chooseCompanionSkin, CompanionRandom, companionSeed } from "./CompanionRules";
import { companionPose } from "./CompanionPose";

describe("effective-time bell scheduling", () => {
  it("requires 25 actual run seconds, then waits indefinitely for a safe gap", () => {
    const scheduler = new BellScheduler(42);
    expect(scheduler.trySpawn(24_999, true)).toBe(false);
    expect(scheduler.trySpawn(25_000, false)).toBe(false);
    expect(scheduler.trySpawn(65_000, false)).toBe(false);
    expect(scheduler.trySpawn(65_001, true)).toBe(true);
    expect(scheduler.trySpawn(65_001, true)).toBe(false);
  });
  it("permits a single collection and no bell throughout entry, follow and farewell", () => {
    const scheduler = new BellScheduler(42);
    expect(scheduler.collect()).toBe(false);
    scheduler.trySpawn(25_000, true);
    expect(scheduler.collect()).toBe(true);
    expect(scheduler.collect()).toBe(false);
    for (const now of [25_500, 26_000, 34_500, 35_000]) expect(scheduler.trySpawn(now, true)).toBe(false);
    scheduler.missed(35_000); // A stale miss cannot end an active companion.
    expect(scheduler.state).toBe("companion");
    scheduler.departed(35_000);
    expect(scheduler.nextEligibleAtMs).toBeGreaterThanOrEqual(70_000);
    expect(scheduler.nextEligibleAtMs).toBeLessThanOrEqual(85_000);
  });
  it("starts a fresh 35–50 second cooldown after a miss or complete departure", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const scheduler = new BellScheduler(seed);
      scheduler.trySpawn(25_000, true); scheduler.missed(28_000);
      const deadline = scheduler.nextEligibleAtMs;
      expect(deadline).toBeGreaterThanOrEqual(63_000); expect(deadline).toBeLessThanOrEqual(78_000);
      expect(scheduler.trySpawn(deadline - .01, true)).toBe(false);
      expect(scheduler.trySpawn(deadline, true)).toBe(true);
      scheduler.collect(); scheduler.departed(deadline + 10_000);
      expect(scheduler.nextEligibleAtMs - deadline - 10_000).toBeGreaterThanOrEqual(35_000);
      expect(scheduler.nextEligibleAtMs - deadline - 10_000).toBeLessThanOrEqual(50_000);
    }
  });
  it("freezes when effective run time stays unchanged and resets on a new run", () => {
    const scheduler = new BellScheduler(42);
    for (let pausedFrame = 0; pausedFrame < 5000; pausedFrame++) expect(scheduler.trySpawn(24_999, true)).toBe(false);
    scheduler.trySpawn(25_000, true); scheduler.collect(); scheduler.stop();
    expect(scheduler.trySpawn(200_000, true)).toBe(false);
    scheduler.reset(); expect(scheduler.state).toBe("waiting");
    expect(scheduler.nextEligibleAtMs).toBe(25_000); expect(scheduler.trySpawn(0, true)).toBe(false);
  });
});

describe("safe group gaps without editing original requests", () => {
  const gap = (changes: Partial<BellGapContext> = {}): BellGapContext => ({
    spawnX: 494, speed: 190, jumpImpulseMultiplier: 1, patternEnded: true,
    lastObstacle: { left: 204, right: 240, kind: "WoodFence" },
    obstacles: [{ left: 204, right: 240, kind: "WoodFence" }], pickups: [], ...changes,
  });
  it("accepts a ground pickup in the middle of a recovered group gap", () => expect(isSafeBellGap(gap())).toBe(true));
  it("defers during a continuous group, too near either group, and after crouch routes", () => {
    expect(isSafeBellGap(gap({ patternEnded: false }))).toBe(false);
    expect(isSafeBellGap(gap({ lastObstacle: { left: 440, right: 476, kind: "Rock" } }))).toBe(false);
    expect(isSafeBellGap(gap({ lastObstacle: { left: -10, right: 20, kind: "Rock" }, obstacles: [] }))).toBe(false);
    for (const kind of ["FlyingBird", "HangingVine", "HangingBranch"] as const) expect(isSafeBellGap(gap({ lastObstacle: { left: 204, right: 240, kind } }))).toBe(false);
    expect(isSafeBellGap(gap({ obstacles: [{ left: 450, right: 480, kind: "Rock" }] }))).toBe(false);
  });
  it("rejects nearby pickups but permits separated existing stars", () => {
    expect(isSafeBellGap(gap({ pickups: [{ x: 480, y: 184, width: 24, height: 24 }] }))).toBe(false);
    expect(isSafeBellGap(gap({ pickups: [{ x: 480, y: 120, width: 24, height: 24 }] }))).toBe(true);
  });
  it("still has a safe interval at maximum speed and with upgraded jumps", () => {
    for (const speed of [190, 270, 390]) for (const multiplier of [1, 1.1]) {
      const right = 494 - (42 + speed * .95 + 1);
      expect(isSafeBellGap(gap({ speed, jumpImpulseMultiplier: multiplier,
        lastObstacle: { left: right - 36, right, kind: "TallStack" }, obstacles: [] }))).toBe(true);
    }
  });
  it("finds natural group gaps after eligibility across seeded, accelerating runs", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const spawn = new SpawnSystem(seed), scheduler = new BellScheduler(seed + 500);
      const obstacles: Array<{ left: number; right: number; kind: ObstacleKind }> = [];
      let ended = false, last: typeof obstacles[number] | null = null, spawnedAt = 0;
      for (let frame = 1; frame <= 4500 && !spawnedAt; frame++) {
        const nowMs = frame * 20, speed = Math.min(390, 190 + nowMs / 1000 * 5.1);
        for (const obstacle of obstacles) { obstacle.left -= speed * .02; obstacle.right -= speed * .02; }
        for (const request of spawn.update(.02, speed)) if (request.type === "obstacle") {
          last = { left: 498, right: 498 + request.definition.width, kind: request.definition.kind };
          obstacles.push(last); ended = request.pattern.index === request.pattern.length - 1;
        }
        const safe = isSafeBellGap(gap({ speed, lastObstacle: last, patternEnded: ended, obstacles }));
        if (scheduler.trySpawn(nowMs, safe)) spawnedAt = nowMs;
      }
      expect(spawnedAt, `seed ${seed} must eventually find a group gap`).toBeGreaterThanOrEqual(25_000);
      expect(spawnedAt).toBeLessThan(60_000);
    }
  });
});

describe("catalog-based companion skins and independent randomness", () => {
  afterEach(() => vi.restoreAllMocks());
  it("validates, deduplicates and excludes the lead without selecting locked skins", () => {
    expect(chooseCompanionSkin(["white", "mint", "mint", "bearcap", "bad", null, 5], "white", () => .5)).toBe("bearcap");
    expect(chooseCompanionSkin(["white", "mint"], "mint", () => .99)).toBe("white");
    expect(chooseCompanionSkin(["white", "white", "invalid"], "white", () => .5)).toBe("white");
    expect(chooseCompanionSkin([], "mint", () => .5)).toBe("white");
  });
  it("uses every current catalog skin without a second maintained list", () => {
    for (const { id } of SHEEP_SKINS) if (id !== "white") expect(chooseCompanionSkin(["white", id], "white", () => 0)).toBe(id);
  });
  it("does not consume Math.random, even when generating a companion seed", () => {
    const random = vi.spyOn(Math, "random");
    const scheduler = new BellScheduler(companionSeed()); scheduler.trySpawn(25_000, true);
    scheduler.missed(27_000); chooseCompanionSkin(["white", "mint"], "white", scheduler.randomSkin);
    expect(random).not.toHaveBeenCalled();
  });
  it("preserves seeded obstacle, star and power-up requests across repeated visits", () => {
    const baseline = new SpawnSystem(987), withCompanion = new SpawnSystem(987);
    const scheduler = new BellScheduler(543);
    const baselineTrace = [], companionTrace = [];
    for (let frame = 1; frame <= 15_000; frame++) {
      const seconds = frame * .02, speed = Math.min(390, 190 + seconds * 5.1);
      baselineTrace.push(...baseline.update(.02, speed).map(request => ({ frame, request })));
      companionTrace.push(...withCompanion.update(.02, speed).map(request => ({ frame, request })));
      if (scheduler.trySpawn(seconds * 1000, true)) {
        scheduler.collect(); chooseCompanionSkin(SHEEP_SKINS.map(skin => skin.id), "white", scheduler.randomSkin);
        scheduler.departed(seconds * 1000 + 10_000);
      }
    }
    expect(companionTrace.length).toBeGreaterThan(100);
    expect(companionTrace).toEqual(baselineTrace);
    expect(new CompanionRandom(123).next()).toBe(new CompanionRandom(123).next());
  });
});

describe("read-only companion poses", () => {
  const lead = Object.freeze({ x: 101, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" as const });
  it("runs in from the visible left and leaves after exactly ten effective seconds", () => {
    const enter = companionPose(lead, 0, -250, false), follow = companionPose(lead, 1000, -250, false);
    expect(enter.x + enter.width / 2).toBeLessThan(-250);
    expect(follow.x + follow.width / 2).toBe(lead.x - lead.displayWidth / 2 - 12);
    expect(companionPose(lead, 8999, -250, false).phase).toBe("following");
    expect(companionPose(lead, 9000, -250, false).phase).toBe("leaving");
    expect(companionPose(lead, 10000, -250, false).phase).toBe("gone");
  });
  it("copies jump/fall/crouch presentation at 85 percent without modifying the lead", () => {
    for (const motionState of ["JUMPING", "FALLING", "RUNNING"] as const) {
      const original = Object.freeze({ ...lead, motionState, y: 150, displayHeight: motionState === "RUNNING" ? 30 : 42 });
      const pose = companionPose(original, 5000, 0, false);
      expect(pose.state).toBe(motionState); expect(pose.y).toBe(150);
      expect(pose.width).toBe(40.8); expect(pose.height).toBe(original.displayHeight * .85);
    }
    expect(companionPose(lead, 9500, 0, true).y).toBe(WORLD.groundY);
    expect(companionPose(lead, 9250, 0, true).angle).toBe(0);
    expect(companionPose(lead, 9500, 0, false).y).toBeLessThan(WORLD.groundY);
  });
});
