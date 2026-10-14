import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene { game = { loop: { time: 0 } }; time = { now: 0 }; }
  class Sprite {
    frame = { width: 48, height: 42 };
    scaleX = 1;
    scaleY = 1;
    body = {
      position: { x: 0, y: 0 }, prevFrame: { x: 0, y: 0 },
      setCollideWorldBounds: vi.fn(), setBounce: vi.fn(), setSize: vi.fn(), setOffset: vi.fn(), updateFromGameObject: vi.fn(),
    };
    constructor(_scene: unknown, public x: number, public y: number) {}
    setOrigin() { return this; }
    setDisplaySize(width: number, height: number) { this.scaleX = width / this.frame.width; this.scaleY = height / this.frame.height; return this; }
    setDepth() { return this; }
  }
  return { default: { Scene, Physics: { Arcade: { Sprite } }, Input: { Events: {}, Keyboard: { Events: {} } }, Scenes: { Events: { PRE_UPDATE: "preupdate" } } } };
});

vi.mock("../environment/EnvironmentSystem", () => ({
  EnvironmentSystem: class { update = vi.fn(); clear = vi.fn(); },
}));
vi.mock("../ui/RunPauseTarget", () => ({
  createRunPauseTarget: vi.fn(() => ({ getData: () => undefined })),
}));

import { RunScene } from "./RunScene";
import { InputSystem } from "../systems/InputSystem";
import { PowerUpSystem } from "../systems/PowerUpSystem";
import { ScoreSystem } from "../systems/ScoreSystem";
import { PowerUp } from "../entities/PowerUp";
import { Obstacle } from "../entities/Obstacle";
import { Star } from "../entities/Star";
import { PLAYER, RUN, SCENE, STORAGE, WORLD } from "../game/Constants";
import { OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { SpawnSystem } from "../systems/SpawnSystemOwner";
import { createRunPauseTarget } from "../ui/RunPauseTarget";
import { runViewportOrigin, runViewportRight } from "../game/Viewport";
import { runHudLayout } from "../ui/RunHudLayout";
import { DeliveryRoute, DELIVERY_ID } from '../delivery/DeliveryRoute';
import { RunGoal } from '../runner-v2/RunGoal';
import { RunTravel } from '../runner-v2/RunTravel';
import { DELIVERY_CHAPTERS } from '../delivery/DeliveryChapters';
import { deliveryStore } from '../delivery/DeliveryStore';
import { deliveryChallengeStore } from '../delivery/DeliveryChallengeStore';
import { RESIDENT_NEW_CHAPTER_IDS } from '../residents/ResidentCatalog';
import type { LandmarkEncounter } from '../scenery/landmarkCatalog';

type SceneUnderTest = {
  scoreSystem: { travelledDistancePx: number };
  environmentSystem: { update: (distancePx: number, deltaMs: number, score?: number) => void; clear: () => void } | null;
  onShutdown: () => void;
  game: { loop: { time: number }; canvas?: { removeEventListener: (name: string, handler: () => void) => void } };
  scene: { pause: (key: string) => void; launch: (key: string) => void; isActive: (key: string) => boolean };
  inputSystem: InputSystem;
  powerUpSystem: PowerUpSystem;
  audioSystem: { play: (cue: string) => void; initializeAfterGesture: () => boolean };
  sheep: { grounded: boolean; setDashing: (active: boolean) => void; setCrouching: (active: boolean) => void; applyJump: (kind: string) => boolean };
  finished: boolean;
  onPreUpdate: (time: number, deltaMs: number) => void;
  onObstacleOverlap: (obstacle?: object) => void;
  onPowerUpOverlap: (powerUp: object) => void;
  onStarOverlap: (star: object) => void;
  onWindowBlur: () => void;
  moveObjects: (deltaSeconds: number) => void;
  update: (time: number, deltaMs: number) => void;
  activeRunTimeMs: number;
  onPointerDown: (pointer: object) => void;
  onPointerMove: (pointer: object) => void;
  onPointerUp: (pointer: object) => void;
  spawnObjects: (deltaSeconds: number) => void;
  scale: { gameSize: { width: number; height: number } };
};

function primeUpdate(scene: SceneUnderTest): { update: ReturnType<typeof vi.fn>; image: ReturnType<typeof vi.fn>; environmentUpdate: ReturnType<typeof vi.fn> } {
  const scoreSystem = { update: vi.fn(), score: 0, travelledDistancePx: 1234 };
  const environmentUpdate = vi.fn();
  const image = vi.fn(() => ({ setDisplaySize() { return this; }, setDepth() { return this; }, setVisible() { return this; }, setPosition() { return this; }, setScrollFactor() { return this; } }));
  const text = vi.fn(() => ({ setOrigin() { return this; }, setTint() { return this; }, setDepth() { return this; }, setVisible() { return this; }, setPosition() { return this; }, setText() { return this; }, setScrollFactor() { return this; } }));
  Object.assign(scene, {
    add: { image, text, bitmapText: text },
    environmentSystem: { update: environmentUpdate, clear: vi.fn() },
    difficultySystem: { update: vi.fn(() => 190), speed: 190 },
    scoreSystem,
    spawnSystem: { update: vi.fn(() => []) },
    obstacles: { getChildren: () => [] },
    stars: { getChildren: () => [] },
    powerUps: { getChildren: () => [] },
    scoreText: { setText: vi.fn() },
    lastScoreText: "00000",
  });
  return { update: scoreSystem.update, image, environmentUpdate };
}

function makeScene(): SceneUnderTest {
  const scene = new RunScene() as unknown as SceneUnderTest;
  scene.scene = { pause: vi.fn(), launch: vi.fn(), isActive: vi.fn(() => false) };
  scene.audioSystem = { play: vi.fn(), initializeAfterGesture: vi.fn(() => true) };
  scene.sheep = { grounded: true, setDashing: vi.fn(), setCrouching: vi.fn(), applyJump: vi.fn(() => true) };
  return scene;
}

describe('delivery mode gameplay isolation', () => {
  beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), localStorage: { getItem: (key: string) => key === STORAGE.saveKey ? '{"version":4}' : null, setItem: vi.fn() } }));
  afterEach(() => vi.unstubAllGlobals());
  it('requires fresh explicit launch data and consumes it before a later endless start', () => {
    const scene = new RunScene(); Object.assign(scene, { data: { set: vi.fn() } });
    const data = { deliveryId: DELIVERY_ID }; scene.init(data);
    expect((scene as unknown as { delivery: DeliveryRoute }).delivery).toBeInstanceOf(DeliveryRoute);
    scene.init(data); expect((scene as unknown as { delivery?: DeliveryRoute }).delivery).toBeUndefined();
  });
  it('bypasses score/spawn/progression and collectible writes for the entire route', () => {
    const scene = makeScene(); const normal = primeUpdate(scene), route = new DeliveryRoute();
    // The independently added v4->v5 skin migration happens during initialization;
    // only subsequent route activity is covered by this no-economic-write check.
    vi.mocked(window.localStorage.setItem).mockClear();
    const spawn = vi.fn(); Object.assign(scene, { delivery: route, spawnSystem: { update: spawn }, deliveryView: { update: vi.fn() } });
    scene.update(0, 20); scene.onStarOverlap({}); scene.onPowerUpOverlap({});
    expect(route.distance).toBeGreaterThan(0); expect(normal.update).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
  it.each(DELIVERY_CHAPTERS)('drives $id scenery with actual obstacle travel, without slowing the first pasture', chapter => {
    const scene=makeScene(),normal=primeUpdate(scene),route=new DeliveryRoute(chapter.id);
    Object.assign(scene,{delivery:route,environmentSystem:{update:normal.environmentUpdate,setWeather:vi.fn()},deliveryView:{update:vi.fn()}});
    scene.update(0,40);
    expect(normal.environmentUpdate).toHaveBeenLastCalledWith(route.distance,40,0);
    expect(route.distance).toBeCloseTo(190*.04,8);
    scene.update(40,40);
    expect(normal.environmentUpdate).toHaveBeenLastCalledWith(route.distance,40,0);
    expect(route.distance).toBeCloseTo(190*.08,8);
  });
  it('fails once without endless rewards, and clears the visual friend immediately', () => {
    const scene = makeScene(), route = new DeliveryRoute(), finish = vi.fn(), panel = vi.fn(), friend = vi.fn();
    vi.mocked(window.localStorage.setItem).mockClear();
    Object.assign(scene, { delivery: route, scoreSystem: { finish }, physics: { pause: vi.fn() }, sheep: { body: { setVelocity: vi.fn() } },
      deliveryPanel: { show: panel }, deliveryView: { stopCompanion: friend }, pauseButton: { input: { enabled: true } } });
    scene.onObstacleOverlap(); scene.onObstacleOverlap();
    expect(route.state).toBe('failed'); expect(panel).toHaveBeenCalledExactlyOnceWith('failure', false, route.chapter.id); expect(friend).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled(); expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("RunScene input before collision", () => {
  beforeEach(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) }));
  afterEach(() => vi.unstubAllGlobals());

  it("awards final-score coins exactly once and passes the balance to ResultScene", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      localStorage: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      },
    });
    vi.stubGlobal("document", { getElementById: vi.fn(() => null) });
    const scene = makeScene();
    const start = vi.fn();
    const runResult = { score: 75, best: 75, newRecord: true };
    let revealResult: (() => void) | undefined;
    Object.assign(scene, {
      scoreSystem: { finish: vi.fn(() => runResult) },
      physics: { pause: vi.fn() },
      sheep: { motionState: "RUNNING", body: { setVelocity: vi.fn() } },
      cameras: { main: { shake: vi.fn() } },
      time: { delayedCall: vi.fn((_delay: number, callback: () => void) => { revealResult = callback; }) },
      scene: { pause: vi.fn(), launch: vi.fn(), isActive: vi.fn(() => false), start },
    });

    const clearCompanions = vi.fn(), clearAnimals = vi.fn(), clearScenery = vi.fn();
    Object.assign(scene, { companions: { clear: clearCompanions }, ambientLife: { clear: clearAnimals }, rareScenery: { clear: clearScenery } });
    scene.onObstacleOverlap();
    scene.onObstacleOverlap();
    revealResult?.();

    expect(clearCompanions).toHaveBeenCalledOnce();
    expect(clearAnimals).toHaveBeenCalledOnce();
    expect(clearScenery).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(SCENE.result, expect.objectContaining({ score: 75, coinsEarned: 3, coinBalance: 3 }));
    expect(JSON.parse([...values.values()][0] ?? "{}").coins).toBe(3);
  });

  it("does not expose keyboard listeners for the mobile-only run", () => {
    const source = (RunScene.prototype as unknown as { create?: () => void }).create?.toString() ?? "";
    expect(source).not.toContain("input.keyboard");
    expect(source).not.toContain("onKeyDown");
    expect(source).not.toContain("onKeyUp");
  });

  it("freezes score, lifetime stars and pickups after a fatal overlap without repeating the reward", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    vi.stubGlobal("document", { getElementById: () => null });
    const scene = makeScene();
    const score = new ScoreSystem();
    const start = vi.fn();
    const results: Array<() => void> = [];
    Object.assign(scene, {
      scoreSystem: score,
      starCountText: { setText: vi.fn() }, streakText: { setText: vi.fn() },
      updatePowerUpHud: vi.fn(),
      physics: { pause: vi.fn() },
      sheep: { motionState: "RUNNING", body: { setVelocity: vi.fn() } },
      cameras: { main: { shake: vi.fn() } },
      time: { delayedCall: (_delay: number, callback: () => void) => results.push(callback) },
      scene: { start },
    });
    const collected = Object.assign(Object.create(Star.prototype), { collected: false, deactivate: vi.fn() }) as Star;
    scene.onStarOverlap(collected);
    scene.onStarOverlap(collected);
    expect(score.score).toBe(100);
    expect(score.starCount).toBe(1);

    scene.onObstacleOverlap();
    const lateStar = Object.assign(Object.create(Star.prototype), { collected: false, deactivate: vi.fn() }) as Star;
    const lateShield = Object.assign(Object.create(PowerUp.prototype), { type: "shield", collected: false, deactivate: vi.fn() }) as PowerUp;
    scene.onStarOverlap(lateStar);
    scene.onPowerUpOverlap(lateShield);
    scene.onObstacleOverlap();
    scene.update(0, 40);

    expect(score.score).toBe(100);
    expect(score.starCount).toBe(1);
    expect(lateStar.collected).toBe(false);
    expect(lateStar.deactivate).not.toHaveBeenCalled();
    expect(lateShield.collected).toBe(false);
    expect(scene.powerUpSystem.isActive("shield", 0)).toBe(false);
    expect(lateShield.deactivate).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(STORAGE.saveKey)!)).toMatchObject({ highScore: 100, totalStars: 1, coins: 4 });
    expect(results).toHaveLength(1);
    results[0]!();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.result, { score: 100, best: 100, newRecord: true, coinsEarned: 4, coinBalance: 4 });
  });

  it("ignores mouse pointers on the touch-only run surface", () => {
    const scene = makeScene();
    const handleGesture = vi.spyOn(scene.inputSystem, "handleGesture");
    scene.onPointerDown({ id: 1, wasTouch: false, worldX: 100, worldY: 100, event: { timeStamp: 0 } });
    scene.onPointerMove({ id: 1, wasTouch: false, worldX: 100, worldY: 60 });
    scene.onPointerUp({ id: 1, wasTouch: false, worldX: 100, worldY: 60 });

    expect(handleGesture).not.toHaveBeenCalled();
    expect(scene.audioSystem.initializeAfterGesture).not.toHaveBeenCalled();
  });

  it("excludes the screen-anchored pause button when the camera expands left and upward", () => {
    const scene = makeScene();
    Object.assign(scene, { scale: { gameSize: { width: 584, height: 360 } } });
    const handleGesture = vi.spyOn(scene.inputSystem, "handleGesture");
    scene.onPointerDown({ id: 1, wasTouch: true, worldX: 188, worldY: -21 });
    expect(handleGesture).not.toHaveBeenCalled();
    scene.onPointerDown({ id: 1, wasTouch: true, worldX: 240, worldY: 100 });
    expect(handleGesture).toHaveBeenCalledOnce();
  });

  it("places an obstacle beyond the visible right edge without extending the reaction distance", () => {
    const scene = makeScene() as SceneUnderTest & { spawnObjects(deltaSeconds: number): void };
    const activate = vi.fn();
    Object.assign(scene, {
      scale: { gameSize: { width: 584, height: 270 } },
      difficultySystem: { speed: 190 },
      obstacles: { getChildren: () => [] },
      spawnSystem: { update: () => [{ type: "obstacle", definition: {}, phase: 0 }] },
      acquireObstacle: () => ({ activate }),
    });
    scene.spawnObjects(0.016);
    expect(activate).toHaveBeenCalledWith(498, 0, 190, "spring");
    expect(498 + runViewportOrigin({ width: 584, height: 270 }).x).toBe(584 + 18);
  });

  it("applies a shield pickup and consumes it on exactly one obstacle hit", () => {
    const scene = makeScene();
    primeUpdate(scene);
    scene.game.loop.time = 100;
    const pickup = Object.assign(Object.create(PowerUp.prototype), { type: "shield", collected: false, deactivate: vi.fn() }) as PowerUp;

    scene.onPowerUpOverlap(pickup);
    expect(scene.powerUpSystem.isActive("shield", 100)).toBe(true);
    expect(pickup.collected).toBe(true);
    expect(pickup.deactivate).toHaveBeenCalledOnce();

    const obstacle = Object.assign(Object.create(Obstacle.prototype), { deactivate: vi.fn() }) as Obstacle;
    scene.onObstacleOverlap(obstacle);
    expect(obstacle.deactivate).toHaveBeenCalledOnce();
    expect(scene.finished).toBe(false);
    expect(scene.powerUpSystem.consumeShield(100)).toBe(false);
  });

  it("ignores an already-collected PowerUp overlap", () => {
    const scene = makeScene();
    const pickup = Object.assign(Object.create(PowerUp.prototype), { type: "starMultiplier", collected: true, deactivate: vi.fn() }) as PowerUp;

    scene.onPowerUpOverlap(pickup);

    expect(scene.powerUpSystem.isActive("starMultiplier", 0)).toBe(false);
    expect(pickup.deactivate).not.toHaveBeenCalled();
  });

  it("pauses and opens PauseScene on window blur", () => {
    const scene = makeScene();

    scene.onWindowBlur();

    expect(scene.scene.pause).toHaveBeenCalledWith(SCENE.run);
    expect(scene.scene.launch).toHaveBeenCalledWith(SCENE.pause);
  });

  it("keeps timed effects active across global clock jumps while the scene is paused", () => {
    const scene = makeScene();
    const { image } = primeUpdate(scene);
    scene.powerUpSystem.activate("shield", 0);
    scene.game.loop.time = 10_000;

    scene.onPreUpdate(10_000, 16);
    scene.update(10_000, 16);

    expect(scene.activeRunTimeMs).toBe(16);
    expect(scene.powerUpSystem.isActive("shield", scene.activeRunTimeMs)).toBe(true);
    expect(image).toHaveBeenCalledWith(80, 54, "powerup-shield");
  });

  it("awards score only for the same capped delta used by world motion", () => {
    const scene = makeScene();
    const { update } = primeUpdate(scene);

    scene.update(0, 5_000);

    expect(update).toHaveBeenCalledWith(190, 40);
  });

  it("updates the environment from ScoreSystem physical distance and capped visual delta", () => {
    const scene = makeScene();
    const { environmentUpdate } = primeUpdate(scene);

    scene.update(0, 40);

    expect(environmentUpdate).toHaveBeenCalledWith(1234, 40, 0);
  });

  it("clears and releases the environment at scene shutdown", () => {
    const scene = makeScene();
    const clear = vi.fn();
    const clearCompanions = vi.fn(), clearAnimals = vi.fn(), clearScenery = vi.fn();
    Object.assign(scene, {
      companions: { clear: clearCompanions },
      ambientLife: { clear: clearAnimals },
      rareScenery: { clear: clearScenery },
      environmentSystem: { update: vi.fn(), clear },
      events: { off: vi.fn() },
      input: { off: vi.fn() },
      game: { loop: { time: 0 }, canvas: { removeEventListener: vi.fn() } },
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), removeEventListener: vi.fn() });
    vi.stubGlobal("document", { removeEventListener: vi.fn() });

    scene.onShutdown();

    expect(clear).toHaveBeenCalledOnce();
    expect(clearCompanions).toHaveBeenCalledOnce();
    expect(clearAnimals).toHaveBeenCalledOnce();
    expect((scene as unknown as { ambientLife?: unknown }).ambientLife).toBeUndefined();
    expect(clearScenery).toHaveBeenCalledOnce();
    expect((scene as unknown as { rareScenery?: unknown }).rareScenery).toBeUndefined();
    expect((scene as unknown as { companions?: unknown }).companions).toBeUndefined();
    expect(scene.environmentSystem).toBeNull();
  });

  it("passes only capped effective time and live read-only pickup bounds to companions", () => {
    const scene = makeScene(); primeUpdate(scene);
    const update = vi.fn(), badgeBounds = { x: 460, y: 180, width: 23, height: 23 };
    Object.assign(scene, { companions: { update }, scale: { gameSize: { width: 584, height: 270 } },
      children: { getByName: () => ({ active: true, visible: true, getBounds: () => badgeBounds }) } });
    scene.onPreUpdate(10000, 5000); scene.update(10000, 5000);
    expect(update).toHaveBeenCalledExactlyOnceWith({ nowMs: 40, deltaSeconds: .04, speed: 190,
      viewport: { width: 584, height: 270 }, obstacles: [], pickups: [badgeBounds] });
  });

  it("advances one capped simulation clock before input and collision processing", () => {
    const scene = makeScene();
    const updateInput = vi.spyOn(scene.inputSystem, "update");

    scene.onPreUpdate(10_000, 200);

    expect(scene.activeRunTimeMs).toBe(40);
    expect(updateInput).toHaveBeenCalledWith(40, true, 850);
  });

  it("timestamps pointer gestures on the active-run clock instead of DOM time", () => {
    const scene = makeScene();
    const handleGesture = vi.spyOn(scene.inputSystem, "handleGesture");
    scene.activeRunTimeMs = 200;

    scene.onPointerDown({ id: 1, wasTouch: true, worldX: 240, worldY: 100, event: { timeStamp: 90_000 } });

    expect(handleGesture).toHaveBeenCalledWith({ type: "down", pointerId: 1, x: 240, y: 100, at: 200 });
  });

  it("awards a passed obstacle and emits the configured near-miss cue once", () => {
    const scene = makeScene();
    const awardPassedObstacle = vi.fn();
    const obstacle = Object.assign(Object.create(Obstacle.prototype), {
      x: 52,
      displayWidth: 27,
      definition: { ...OBSTACLE_DEFINITIONS[0], width: 27 },
      active: true,
      passed: false,
      moveAt: vi.fn(),
      deactivate: vi.fn(),
    }) as Obstacle;
    Object.assign(scene, {
      difficultySystem: { speed: 190 },
      obstacles: { getChildren: () => [obstacle] },
      stars: { getChildren: () => [] },
      powerUps: { getChildren: () => [] },
      scoreSystem: { awardPassedObstacle, missStar: vi.fn() },
    });

    scene.moveObjects(0);

    expect(awardPassedObstacle).toHaveBeenCalledOnce();
    expect(scene.audioSystem.play).toHaveBeenCalledWith("nearMiss");
  });

  it("uses active simulation time for the 260ms touch hold", () => {
    const scene = makeScene();
    scene.inputSystem = new InputSystem(true);
    scene.onPointerDown({ id: 1, wasTouch: true, worldX: 240, worldY: 100, event: { timeStamp: 90_000 } });
    for (let frame = 1; frame <= 6; frame += 1) scene.onPreUpdate(90_000 + frame * 40, 40);
    expect(scene.inputSystem.isObstacleImmune(scene.activeRunTimeMs)).toBe(false);
    scene.onPreUpdate(90_000 + 6 * 40 + 19, 19);
    expect(scene.inputSystem.isObstacleImmune(scene.activeRunTimeMs)).toBe(false);
    scene.onPreUpdate(90_000 + 6 * 40 + 20, 1);
    expect(scene.inputSystem.isObstacleImmune(scene.activeRunTimeMs)).toBe(true);
  });
});

describe("RunScene default control hint", () => {
  it("does not advertise Dash when disabled", () => {
    const hint = (RunScene as unknown as { CONTROL_HINT?: string }).CONTROL_HINT;

    expect(hint).toBeDefined();
    expect(hint).not.toContain("冲刺");
    expect(hint).not.toContain("Shift");
  });
});

describe("RunScene adaptive viewport", () => {
  beforeEach(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), addEventListener: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  it.each([[480, 270], [584, 270], [480, 360], [960, 270]])(
    'keeps passed obstacles until the complete artwork exits the %sx%s viewport', (width, height) => {
      const scene = makeScene(), award = vi.fn(), left = -runViewportOrigin({ width, height }).x;
      const definition = OBSTACLE_DEFINITIONS.find(item => item.kind === 'WideLog')!;
      const obstacle = Object.assign(Object.create(Obstacle.prototype), {
        x: 0, displayWidth: definition.width * definition.visualScale!, definition,
        active: true, passed: false, moveAt: vi.fn(), deactivate: vi.fn(),
      }) as Obstacle;
      Object.assign(scene, { scale: { gameSize: { width, height } }, difficultySystem: { speed: 190 },
        obstacles: { getChildren: () => [obstacle] }, stars: { getChildren: () => [] }, powerUps: { getChildren: () => [] },
        scoreSystem: { awardPassedObstacle: award } });
      scene.moveObjects(.016); scene.moveObjects(.016);
      expect(award).toHaveBeenCalledOnce(); expect(obstacle.passed).toBe(true);
      expect(obstacle.deactivate).not.toHaveBeenCalled();
      const visualWidthFromOrigin = (definition.width + obstacle.displayWidth) / 2;
      // A visible tail and the original twenty-pixel offscreen margin both survive.
      for (const visualRight of [left + 1, left - 19]) {
        obstacle.x = visualRight - visualWidthFromOrigin; scene.moveObjects(.016);
        expect(obstacle.deactivate).not.toHaveBeenCalled();
      }
      obstacle.x = left - 21 - visualWidthFromOrigin; scene.moveObjects(.016);
      expect(obstacle.deactivate).toHaveBeenCalledOnce(); expect(award).toHaveBeenCalledOnce();
    },
  );

  it.each([480, 584, 960])('uses the same visual exit boundary in a %spx delivery route', width => {
    const scene = makeScene(); primeUpdate(scene);
    const left = -runViewportOrigin({ width, height: 270 }).x, definition = OBSTACLE_DEFINITIONS[0];
    let at = 0;
    const obstacle = Object.assign(Object.create(Obstacle.prototype), { active: true, x: 0, definition,
      displayWidth: definition.width * definition.visualScale!, getData: () => at, deactivate: vi.fn() }) as Obstacle;
    Object.assign(obstacle, { body: { reset: (x: number) => { obstacle.x = x; } } });
    Object.assign(scene, { scale: { gameSize: { width, height: 270 } },
      delivery: Object.assign(new DeliveryRoute(), { advance: () => [] }), obstacles: { getChildren: () => [obstacle] } });
    for (const visualRight of [left + 1, left - 19, left - 21]) {
      at = visualRight - (definition.width + obstacle.displayWidth) / 2 - WORLD.width - 18;
      scene.update(0, 0);
      expect(obstacle.deactivate).toHaveBeenCalledTimes(visualRight < left - 20 ? 1 : 0);
    }
  });

  it('recomputes the exit edge after a viewport resize without moving the obstacle', () => {
    const scene = makeScene(); primeUpdate(scene);
    const definition = OBSTACLE_DEFINITIONS[0], obstacle = Object.assign(Object.create(Obstacle.prototype), {
      x: -85, definition, displayWidth: definition.width * definition.visualScale!, active: true, passed: true, moveAt: vi.fn(), deactivate: vi.fn(),
    }) as Obstacle;
    Object.assign(scene, { scale: { gameSize: { width: 584, height: 270 } }, obstacles: { getChildren: () => [obstacle] } });
    scene.moveObjects(.016); expect(obstacle.deactivate).not.toHaveBeenCalled(); expect(obstacle.x).toBe(-85);
    scene.scale.gameSize.width = 480; scene.moveObjects(.016);
    expect(obstacle.deactivate).toHaveBeenCalledOnce(); expect(obstacle.x).toBe(-85);
  });

  it('retains every scheduled spawn within the existing pool capacity at the widest viewport', () => {
    // The longer visible tail must never make the pool silently drop a request.
    for (const speed of [190, 390, 468]) for (const seed of [1, 42, 731, 65000]) {
      const spawner = new SpawnSystem(seed), active: { x: number; definition: (typeof OBSTACLE_DEFINITIONS)[number] }[] = [];
      let spawned = 0;
      for (let frame = 0; frame < 6000; frame++) {
        for (const request of spawner.update(.04, speed)) if (request.type === 'obstacle') {
          expect(active.filter(o => o.definition.kind === request.definition.kind).length).toBeLessThan(3);
          active.push({ x: WORLD.width + 18, definition: request.definition }); spawned++;
        }
        for (let i = active.length - 1; i >= 0; i--) {
          const o = active[i]; o.x -= speed * .04;
          const right = o.x + o.definition.width * (1 + (o.definition.visualScale ?? 1)) / 2;
          if (right < -runViewportOrigin({ width: 960, height: 270 }).x - 20) active.splice(i, 1);
        }
      }
      expect(spawned).toBeGreaterThan(70);
    }
  });

  it.each([[480, 270], [584, 270], [480, 360], [960, 270]])(
    "conserves star requests for safe routes while spawning obstacles and powerups beyond the %sx%s edge",
    (width, height) => {
      const scene = makeScene();
      const obstacle = { activate: vi.fn() };
      const star = { activate: vi.fn() };
      const powerUp = { activate: vi.fn() };
      const starRequest = { type: "star", y: 132, phase: 0.6 } as const;
      const routeWindow = { openingSafe: true, patternEnded: true, nextObstacleInPx: 480 };
      const enqueue = vi.fn(), planRoutes = vi.fn(), forecast = vi.fn(() => routeWindow);
      const update = vi.fn(() => [
        { type: "obstacle", definition: OBSTACLE_DEFINITIONS[0], phase: 0.3 },
        starRequest,
        { type: "powerUp", powerUp: "shield", y: 138, phase: 0.9 },
      ]);
      Object.assign(scene, {
        scale: { gameSize: { width, height } }, spawnSystem: { update, starRouteWindow: forecast },
        difficultySystem: { speed: 190 },
        obstacles: { getChildren: () => [] },
        stars: { getChildren: () => [] }, powerUps: { getChildren: () => [] },
        children: { getByName: () => null }, sheep: { ...scene.sheep, x: PLAYER.x + PLAYER.width / 2 },
        starRoutes: { enqueue, update: planRoutes },
        acquireObstacle: vi.fn(() => obstacle), acquireStar: vi.fn(() => star), acquirePowerUp: vi.fn(() => powerUp),
      });

      scene.spawnObjects(0.04);

      expect(update).toHaveBeenCalledExactlyOnceWith(0.04, 190);
      const visibleRight = runViewportRight({ width, height });
      expect(obstacle.activate).toHaveBeenCalledWith(visibleRight + 18, 0.3, 190, "spring");
      expect(enqueue).toHaveBeenCalledExactlyOnceWith(starRequest);
      expect(star.activate).not.toHaveBeenCalled();
      expect(forecast).toHaveBeenCalledExactlyOnceWith(190);
      expect(planRoutes).toHaveBeenCalledExactlyOnceWith({ speed: 190, spawnX: visibleRight + 14,
        playerX: PLAYER.x + PLAYER.width / 2, jumpImpulseMultiplier: 1,
        window: routeWindow, obstacles: [], pickups: [] });
      expect(powerUp.activate).toHaveBeenCalledWith(visibleRight + 14, 138, "shield", 0.9, 190);
      expect(visibleRight + runViewportOrigin({ width, height }).x).toBe(width);
      expect(visibleRight - PLAYER.x).toBe(WORLD.width - PLAYER.x);

      scene.scale.gameSize.width = 584;
      scene.spawnObjects(0.04);
      expect(obstacle.activate).toHaveBeenLastCalledWith(498, 0.3, 190, "spring");
      expect(planRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ spawnX: 494 }));
    },
  );

  it("keeps the seeded spawn cadence, minimum gaps and pickup paths across viewport widths", () => {
    const sample = (width: number) => {
      const scene = makeScene();
      const events: { frame: number; kind: string; values: unknown[] }[] = [];
      let frame = 0;
      Object.assign(scene, {
        scale: { gameSize: { width, height: 270 } }, spawnSystem: new SpawnSystem(731), difficultySystem: { speed: 390 },
        obstacles: { getChildren: () => [] },
        acquireObstacle: (definition: { width: number; kind: string }) => ({ activate: (x: number, ...values: unknown[]) => {
          events.push({ frame, kind: "obstacle", values: [definition.width, definition.kind, x, ...values] });
        } }),
        acquireStar: () => ({ activate: (x: number, ...values: unknown[]) => events.push({ frame, kind: "star", values: [x, ...values] }) }),
        acquirePowerUp: () => ({ activate: (x: number, ...values: unknown[]) => events.push({ frame, kind: "powerUp", values: [x, ...values] }) }),
      });
      for (frame = 1; frame <= 1500; frame += 1) scene.spawnObjects(0.04);
      return events;
    };
    const baseline = sample(480);
    expect(sample(584)).toEqual(baseline);
    expect(sample(960)).toEqual(baseline);
    const obstacles = baseline.filter((event) => event.kind === "obstacle");
    expect(obstacles.length).toBeGreaterThan(30);
    expect(obstacles[0]?.frame).toBe(Math.ceil(RUN.safeSpawnWindow / 0.04));
    for (let index = 1; index < obstacles.length; index += 1) {
      const previous = obstacles[index - 1]!;
      const current = obstacles[index]!;
      const gap = (current.frame - previous.frame) * 0.04 * 390 - Number(previous.values[0]);
      expect(gap).toBeGreaterThanOrEqual(Math.max(RUN.minimumJumpDistance, RUN.obstacleSpacing, 390 * RUN.minimumReactionTime));
    }
  });

  it.each([584, 960])("preserves exact scheduled gaps after shrinking a live %spx obstacle stream", (initialWidth) => {
    const sample = (shrink: boolean) => {
      const scene = makeScene();
      const obstacles: Obstacle[] = [];
      const entries: { frame: number; type: string; x: number; gap?: number }[] = [];
      let frame = 0;
      Object.assign(scene, {
        scale: { gameSize: { width: initialWidth, height: 270 } }, spawnSystem: new SpawnSystem(731), difficultySystem: { speed: 390 },
        obstacles: { getChildren: () => obstacles },
        acquireObstacle: (definition: (typeof OBSTACLE_DEFINITIONS)[number]) => {
          const obstacle = Object.assign(Object.create(Obstacle.prototype), {
            active: false, x: 0, definition, displayWidth: definition.width,
            activate(x: number) {
              const previous = obstacles.filter((item) => item !== obstacle && item.active).at(-1);
              entries.push({ frame, type: "obstacle", x, gap: previous ? x - previous.rightEdge : undefined });
              this.x = x;
              this.active = true;
            },
          }) as Obstacle;
          obstacles.push(obstacle);
          return obstacle;
        },
        acquireStar: () => ({ activate: (x: number) => entries.push({ frame, type: "star", x }) }),
        acquirePowerUp: () => ({ activate: (x: number) => entries.push({ frame, type: "powerUp", x }) }),
      });
      for (frame = 1; frame <= 500; frame += 1) {
        for (const obstacle of obstacles) {
          if (!obstacle.active) continue;
          obstacle.x -= 390 * 0.04;
          if (obstacle.rightEdge < -20) obstacle.active = false;
        }
        if (shrink && frame === 40) scene.scale.gameSize.width = 480;
        scene.spawnObjects(0.04);
      }
      expect(entries.filter((entry) => entry.type === "powerUp")).toHaveLength(1);
      return entries;
    };
    expect(sample(true)).toEqual(sample(false));
  });

  it("keeps the world entry edge and existing objects stable during rapid viewport resizing", () => {
    const scene = makeScene();
    const obstacle = Object.assign(Object.create(Obstacle.prototype), { active: true, x: 300, displayWidth: 30 }) as Obstacle;
    const activate = vi.fn();
    Object.assign(scene, {
      scale: { gameSize: { width: 960, height: 270 } }, difficultySystem: { speed: 190 },
      obstacles: { getChildren: () => [obstacle] },
      spawnSystem: { update: () => [{ type: "obstacle", definition: OBSTACLE_DEFINITIONS[0], phase: 0 }] },
      acquireObstacle: () => ({ activate }),
    });
    for (const width of [960, 480, 584, 480]) {
      scene.scale.gameSize.width = width;
      scene.spawnObjects(0.04);
      expect(activate).toHaveBeenLastCalledWith(498, 0, 190, "spring");
      expect(498 + runViewportOrigin(scene.scale.gameSize).x).toBe(width + 18);
      expect(obstacle.x).toBe(300);
    }
  });

  it.each([[480, 270], [584, 270], [480, 360]])(
    "excludes the screen-space pause target but accepts nearby touch gestures at %sx%s", (width, height) => {
      const scene = makeScene();
      scene.scale = { gameSize: { width, height } };
      const handleGesture = vi.spyOn(scene.inputSystem, "handleGesture");
      const origin = runViewportOrigin({ width, height });
      const pause = runHudLayout({ width, height }, { left: 0, right: 0, top: 0, bottom: 0 }).pause;
      scene.onPointerDown({ id: 1, wasTouch: true, worldX: pause.x + pause.width / 2 - origin.x, worldY: pause.y + pause.height / 2 - origin.y });
      expect(handleGesture).not.toHaveBeenCalled();
      scene.onPointerDown({ id: 1, wasTouch: true, worldX: width - 70 - origin.x, worldY: 52 - origin.y });
      expect(handleGesture).toHaveBeenCalledOnce();
      expect(handleGesture).toHaveBeenCalledWith(expect.objectContaining({ x: width - 70 - origin.x, y: 52 - origin.y }));
    },
  );

  it("resizes the camera and cancels a held gesture only on logical resize while leaving physics unchanged", () => {
    const scene = makeScene();
    const resizeListeners: (() => void)[] = [];
    const texts: { x: number; y: number; text: string }[] = [];
    const text = vi.fn((x: number, y: number, value: string) => {
      const item = {
        x, y, text: value,
        setOrigin() { return this; }, setTint() { return this; }, setName() { return this; }, setDepth() { return this; }, setScrollFactor() { return this; }, setVisible() { return this; },
        setX(value: number) { this.x = value; return this; },
      };
      texts.push(item);
      return item;
    });
    const setBounds = vi.fn();
    const setScroll = vi.fn();
    Object.assign(scene, {
      add: { text, bitmapText: (x: number, y: number, _font: string, value: string) => text(x, y, value), existing: vi.fn() }, registry: { get: () => scene.audioSystem, set: vi.fn() },
      physics: { world: { setBounds }, add: { existing: vi.fn(), group: vi.fn(() => ({ getChildren: () => [] })), overlap: vi.fn() } },
      cameras: { main: { setScroll } }, input: { on: vi.fn() }, events: { on: vi.fn(), once: vi.fn() },
      scale: { gameSize: { width: 584, height: 270 }, on: (_name: string, callback: () => void) => resizeListeners.push(callback) },
      game: { canvas: { addEventListener: vi.fn() } },
    });
    vi.stubGlobal("document", { addEventListener: vi.fn(), getElementById: () => null });

    (scene as unknown as RunScene).create();

    const sheep = scene.sheep as unknown as { x: number; y: number; scaleX: number; scaleY: number };
    expect(vi.mocked(createRunPauseTarget).mock.results.at(-1)?.value).toBeDefined();
    expect(setBounds).toHaveBeenCalledExactlyOnceWith(0, 0, WORLD.width, WORLD.groundY);
    expect(sheep.x).toBe(PLAYER.x + PLAYER.width / 2);
    expect(sheep.y).toBe(WORLD.groundY);
    expect(setScroll.mock.calls.at(-1)?.[0]).toBe(-104);
    expect(setScroll.mock.calls.at(-1)?.[1]).toBeCloseTo(0);
    let hud = runHudLayout(scene.scale.gameSize, { left: 0, right: 0, top: 0, bottom: 0 });
    expect(hud.pause.x + hud.pause.width / 2).toBe(292);
    expect(hud.pause.y + hud.pause.height / 2).toBeCloseTo(24.7777777778);
    const geometry = { x: sheep.x, y: sheep.y, scaleX: sheep.scaleX, scaleY: sheep.scaleY };
    const cancel = vi.spyOn(scene.inputSystem, "cancel");
    resizeListeners.forEach((refresh) => refresh());
    expect(cancel).not.toHaveBeenCalled();
    scene.onPointerDown({ id: 1, wasTouch: true, worldX: 200, worldY: 150 });

    scene.scale.gameSize = { width: 480, height: 360 };
    resizeListeners.forEach((refresh) => refresh());
    // The same screen point moves upward in world space when the camera shifts.
    scene.onPointerUp({ id: 1, wasTouch: true, worldX: 200, worldY: 105 });

    expect(cancel).toHaveBeenCalledOnce();
    expect(scene.inputSystem.update(16, true)).toMatchObject({ jump: null, crouching: false, dashing: false });
    expect(setScroll.mock.calls.at(-1)?.[0]).toBeCloseTo(0);
    expect(setScroll.mock.calls.at(-1)?.[1]).toBe(-45);
    hud = runHudLayout(scene.scale.gameSize, { left: 0, right: 0, top: 0, bottom: 0 });
    expect(hud.pause.x + hud.pause.width / 2).toBe(240);
    expect(hud.pause.y + hud.pause.height / 2).toBeCloseTo(24.7777777778);
    expect(texts).toHaveLength(0);
    expect({ x: sheep.x, y: sheep.y, scaleX: sheep.scaleX, scaleY: sheep.scaleY }).toEqual(geometry);
    expect(setBounds).toHaveBeenCalledOnce();
  });
});

describe("RunScene progression effects", () => {
  it("reloads persisted upgrades for each run", () => {
    const stored = JSON.stringify({
      version: 5, highScore: 0, totalStars: 9, spentStars: 0, coins: 12, selectedSkin: "black", unlockedSkins: ["white", "black"],
      upgrades: { jump: 2, speed: 2, magnet: 3, dash: 5 },
      settings: { music: true, sfx: true, musicVolume: 1, sfxVolume: 1 },
    });
    const setItem = vi.fn();
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: vi.fn((key: string) => key === STORAGE.saveKey ? stored : null), setItem },
    });
    const scene = makeScene();
    const runtime = scene as unknown as {
      refreshProgression?: () => void;
      upgradeEffects?: { jumpImpulseMultiplier: number; worldSpeedMultiplier: number; magnetRadiusPx: number; dashInvulnerabilityMs: number };
      selectedSkin?: string;
      difficultySystem?: { speed: number };
    };

    expect(typeof runtime.refreshProgression).toBe("function");
    if (!runtime.refreshProgression) return;
    runtime.refreshProgression.call(scene);

    expect(runtime.upgradeEffects).toEqual({
      jumpImpulseMultiplier: 1.06, worldSpeedMultiplier: 1.04, magnetRadiusPx: 146, dashInvulnerabilityMs: 280,
    });
    expect(runtime.selectedSkin).toBe("black");
    expect(runtime.difficultySystem?.speed).toBe(RUN.initialSpeed * 1.04);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("passes the upgrade magnet radius only while Magnet is active", () => {
    const scene = makeScene();
    const updateMotion = vi.fn();
    const star = Object.assign(Object.create(Star.prototype), {
      x: 100, y: 150, active: true, collected: false, updateMotion,
      getBounds: () => ({ right: 112 }),
    }) as Star;
    Object.assign(scene, {
      difficultySystem: { speed: 190 },
      obstacles: { getChildren: () => [] },
      stars: { getChildren: () => [star] },
      powerUps: { getChildren: () => [] },
      upgradeEffects: { jumpImpulseMultiplier: 1.06, worldSpeedMultiplier: 1.04, magnetRadiusPx: 146, dashInvulnerabilityMs: 280 },
    });
    Object.assign(scene.sheep, { x: PLAYER.x, y: 150 });
    scene.powerUpSystem.activate("magnet", 0);

    scene.moveObjects(0);
    expect(updateMotion).toHaveBeenCalledWith(0, 190, { x: PLAYER.x, y: 150 - PLAYER.height / 2, radiusPx: 146 });

    scene.powerUpSystem.reset();
    updateMotion.mockClear();
    scene.moveObjects(0);
    expect(updateMotion).toHaveBeenCalledWith(0, 190, undefined);
  });
});

describe('runner v2 actual-event wiring', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), removeEventListener: vi.fn(),
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    vi.stubGlobal('document', { getElementById: () => null, removeEventListener: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('observes one accepted star exactly once even with double-star scoring, then celebrates the completed group once', () => {
    const scene = makeScene(), score = new ScoreSystem(), goal = new RunGoal({ random: () => 0 }), travel = new RunTravel();
    const collectRoute = vi.fn(() => ({ id: 1, kind: 'arc', collected: 3, total: 3, completed: true }));
    const notifyStarGroup = vi.fn(), feedback = vi.fn(), journalStar = vi.fn();
    Object.assign(scene, { scoreSystem: score, runGoal: goal, travel, journey: { star: journalStar },
      starRoutes: { collect: collectRoute }, companions: { notifyStarGroup }, runFeedback: { collect: feedback } });
    scene.powerUpSystem.activate('starMultiplier', 0);
    const star = Object.assign(Object.create(Star.prototype), { x: 150, y: 170, collected: false, missed: false, deactivate: vi.fn() }) as Star;
    scene.onStarOverlap(star); scene.onStarOverlap(star);
    expect(score.score).toBe(RUN.starBonus * 2); expect(score.starCount).toBe(1);
    expect(goal.snapshot().progress).toBe(1); expect(travel.snapshot().stars).toBe(1);
    expect(journalStar).toHaveBeenCalledOnce(); expect(collectRoute).toHaveBeenCalledExactlyOnceWith(star);
    expect(notifyStarGroup).toHaveBeenCalledOnce(); expect(star.deactivate).toHaveBeenCalledOnce();
    expect(vi.mocked(scene.audioSystem.play).mock.calls.filter(([cue]) => cue === 'starGroup')).toHaveLength(1);
    expect(feedback).toHaveBeenCalledWith(150, 170, 0xffe292);
    expect(feedback).toHaveBeenCalledWith(150, 170);
  });

  it('does not count missed, already-collected or late stars and leaves the original reward guard intact', () => {
    const scene = makeScene(), score = new ScoreSystem(), goal = new RunGoal({ random: () => 0 }), travel = new RunTravel(), collect = vi.fn();
    Object.assign(scene, { scoreSystem: score, runGoal: goal, travel, starRoutes: { collect } });
    for (const state of [{ collected: true, missed: false }, { collected: false, missed: true }]) {
      const star = Object.assign(Object.create(Star.prototype), { ...state, deactivate: vi.fn() }) as Star;
      scene.onStarOverlap(star); expect(star.deactivate).not.toHaveBeenCalled();
    }
    scene.finished = true;
    scene.onStarOverlap(Object.assign(Object.create(Star.prototype), { collected: false, missed: false, deactivate: vi.fn() }));
    expect(score.starCount).toBe(0); expect(goal.snapshot().progress).toBe(0); expect(travel.snapshot().stars).toBe(0);
    expect(collect).not.toHaveBeenCalled(); expect(scene.audioSystem.play).not.toHaveBeenCalled();
  });

  it('completes the obstacle objective from eight actual successful passes once without adding a reward', () => {
    const scene = makeScene(), score = new ScoreSystem(), complete = vi.fn(), goal = new RunGoal({ random: () => .5, onComplete: complete });
    const obstacles = Array.from({ length: 8 }, () => Object.assign(Object.create(Obstacle.prototype), {
      x: 40, definition: OBSTACLE_DEFINITIONS[0], displayWidth: 36, active: true, passed: false, moveAt: vi.fn(), deactivate: vi.fn(),
    }) as Obstacle);
    Object.assign(scene, { scoreSystem: score, runGoal: goal, difficultySystem: { speed: 190 },
      obstacles: { getChildren: () => obstacles }, stars: { getChildren: () => [] }, powerUps: { getChildren: () => [] } });
    scene.moveObjects(0); scene.moveObjects(0);
    expect(goal.snapshot()).toMatchObject({ progress: 8, complete: true }); expect(complete).toHaveBeenCalledOnce();
    expect(score.score).toBe(8 * RUN.obstacleBonus); expect(score.starCount).toBe(0);
    expect(obstacles.every(obstacle => obstacle.passed)).toBe(true);
    expect(vi.mocked(scene.audioSystem.play).mock.calls.filter(([cue]) => cue === 'nearMiss')).toHaveLength(8);
  });

  it('passes only active obstacle and pickup geometry plus the original spawn forecast into the safe route planner', () => {
    const scene = makeScene(), update = vi.fn(), enqueue = vi.fn();
    const obstacle = Object.assign(Object.create(Obstacle.prototype), { x: 300, active: true, definition: OBSTACLE_DEFINITIONS[0] }) as Obstacle;
    const starBounds = { x: 420, y: 130, width: 16, height: 16 }, badgeBounds = { x: 410, y: 190, width: 23, height: 23 };
    const pickup = { active: true, visible: true, getBounds: () => starBounds }, badge = { active: true, visible: true, getBounds: () => badgeBounds };
    const routeWindow = { openingSafe: false, patternEnded: true, nextObstacleInPx: 350 };
    Object.assign(scene, { scale: { gameSize: { width: 584, height: 270 } }, difficultySystem: { speed: 190 },
      spawnSystem: { update: () => [], starRouteWindow: () => routeWindow }, starRoutes: { enqueue, update },
      sheep: { ...scene.sheep, x: 101 }, obstacles: { getChildren: () => [obstacle, { active: false }] },
      stars: { getChildren: () => [pickup] }, powerUps: { getChildren: () => [{ active: true, visible: false }] },
      children: { getByName: (name: string) => name === 'hidden-collection' ? badge : null } });
    scene.spawnObjects(.04);
    expect(enqueue).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith({ speed: 190, spawnX: 494, playerX: 101, jumpImpulseMultiplier: 1,
      window: routeWindow, obstacles: [{ left: 300, right: obstacle.rightEdge, kind: obstacle.definition.kind }], pickups: [starBounds, badgeBounds] });
  });

  it('freezes the objective and its view across a paused wall-clock jump and resumes from capped effective delta', () => {
    const scene = makeScene(); primeUpdate(scene);
    const goal = new RunGoal({ random: () => .9 }), travel = new RunTravel(), updateView = vi.fn();
    Object.assign(scene, { runGoal: goal, travel, goalView: { update: updateView },
      environmentSystem: { update: vi.fn(), presentation: () => ({ theme: 'summer' }) } });
    scene.onPreUpdate(0, 40); scene.update(0, 40);
    scene.onWindowBlur(); const paused = goal.snapshot(); scene.game.loop.time = 999_000;
    // Phaser does not dispatch scene update/preupdate while paused; snapshot reads never advance time.
    expect(goal.snapshot()).toEqual(paused); expect(updateView).toHaveBeenCalledExactlyOnceWith(40);
    expect(scene.activeRunTimeMs).toBe(40); expect(travel.snapshot().seasons).toEqual(['summer']);
    scene.onPreUpdate(999_000, 40); scene.update(999_000, 40);
    expect(goal.snapshot().progress).toBeCloseTo(.08); expect(scene.activeRunTimeMs).toBe(80);
    expect(updateView).toHaveBeenCalledTimes(2); expect(travel.snapshot().goal?.progress).toBeCloseTo(.08);
  });

  it('notifies a companion about the starting-best record only once across consecutive frames', () => {
    const scene = makeScene(); primeUpdate(scene);
    const travel = new RunTravel(), notifyRecord = vi.fn(), companionsUpdate = vi.fn();
    Object.assign(scene, { travel, scoreSystem: { update: vi.fn(), score: 101, bestAtStart: 100, travelledDistancePx: 0 },
      environmentSystem: { update: vi.fn(), presentation: () => ({ theme: 'spring' }) },
      companions: { notifyRecord, update: companionsUpdate }, children: { getByName: () => null } });
    scene.update(0, 40); scene.update(0, 40);
    expect(travel.snapshot().newRecord).toBe(true); expect(notifyRecord).toHaveBeenCalledOnce();
  });

  it('keeps delivery mode on its own mission path without advancing endless goals or travel statistics', () => {
    const scene = makeScene(); primeUpdate(scene);
    const goal = new RunGoal({ random: () => .9 }), travel = new RunTravel(), updateView = vi.fn(), route = new DeliveryRoute();
    Object.assign(scene, { delivery: route, runGoal: goal, travel, goalView: { update: updateView } });
    scene.update(0, 40);
    const star = Object.assign(Object.create(Star.prototype), { collected: false, missed: false, deactivate: vi.fn() });
    scene.onStarOverlap(star);
    expect(route.distance).toBeGreaterThan(0); expect(goal.snapshot().progress).toBe(0);
    expect(travel.snapshot()).toEqual(new RunTravel().snapshot()); expect(updateView).not.toHaveBeenCalled();
    expect(star.deactivate).not.toHaveBeenCalled();
  });

  it('ignores an animal plan until nonzero age and sustained real visible ink, excluding pond and offscreen sprites', () => {
    const scene = makeScene(), travel = new RunTravel(); let elapsedMs = 0;
    const image = { name: 'ambient-life:duck', active: true, visible: true, alpha: 1,
      getBounds: () => ({ x: 180, y: 190, right: 200, bottom: 210 }) };
    Object.assign(scene, { travel, scale: { gameSize: { width: 480, height: 270 } }, cameras: { main: { scrollX: 0, scrollY: 0 } },
      ambientLife: { snapshot: () => ({ kind: 'duck-family', elapsedMs }) }, children: { list: [image] } });
    const observe = (scene as unknown as { observeVisibleAnimal(deltaMs: number): void }).observeVisibleAnimal.bind(scene);
    observe(1000); expect(travel.snapshot().animals).toEqual([]);
    elapsedMs = 40; image.visible = false; observe(1000); expect(travel.snapshot().animals).toEqual([]);
    image.visible = true; image.name = 'ambient-life:pond'; observe(1000); expect(travel.snapshot().animals).toEqual([]);
    image.name = 'ambient-life:duck'; image.getBounds = () => ({ x: 500, y: 190, right: 520, bottom: 210 });
    observe(1000); expect(travel.snapshot().animals).toEqual([]);
    image.getBounds = () => ({ x: 180, y: 190, right: 200, bottom: 210 });
    for (let i = 0; i < 4; i++) observe(40); expect(travel.snapshot().animals).toEqual([]);
    observe(40); observe(1000); expect(travel.snapshot().animals).toEqual(['duck-family']);
  });

  it('passes the frozen final real-event travel snapshot and actual lead skin to results without repeating settlement', () => {
    const scene = makeScene(), score = new ScoreSystem(), goal = new RunGoal({ random: () => 0 }), travel = new RunTravel();
    const start = vi.fn(), clearRoutes = vi.fn(), clearView = vi.fn(); let reveal: (() => void) | undefined;
    Object.assign(scene, { scoreSystem: score, runGoal: goal, travel, selectedSkin: 'cloud', starRoutes: { clear: clearRoutes, collect: () => null }, goalView: { clear: clearView },
      physics: { pause: vi.fn() }, sheep: { motionState: 'RUNNING', body: { setVelocity: vi.fn() } }, cameras: { main: { shake: vi.fn() } },
      time: { delayedCall: (_delay: number, callback: () => void) => { reveal = callback; } }, scene: { start } });
    travel.visitSeason('spring'); travel.summon('mint'); travel.visibleAnimal('duck-family'); travel.visibleLandmark('windmill'); travel.collect('spring-flower');
    for (let i = 0; i < 2; i++) scene.onStarOverlap(Object.assign(Object.create(Star.prototype), { collected: false, missed: false, deactivate: vi.fn() }));
    scene.onObstacleOverlap(); scene.onObstacleOverlap(); reveal?.();
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(SCENE.result, expect.objectContaining({ score: 200, leadSkin: 'cloud', coinsEarned: 8,
      travel: { seasons: ['spring'], stars: 2, companionSkins: ['mint'], animals: ['duck-family'], landmarks: ['windmill'],
        newCollections: ['spring-flower'], goal: expect.objectContaining({ progress: 2, complete: false }), newRecord: true } }));
    const result = start.mock.calls[0]![1]; expect(Object.isFrozen(result.travel)).toBe(true); expect(Object.isFrozen(result.travel.goal)).toBe(true);
    expect(clearRoutes).toHaveBeenCalledOnce(); expect(clearView).toHaveBeenCalledOnce();
    travel.star(); expect(travel.snapshot().stars).toBe(2);
  });

  it('clears all runner v2 observers and releases references on exit so callbacks cannot contaminate another run', () => {
    const scene = makeScene(), goal = new RunGoal({ random: () => .9 }), travel = new RunTravel(), clearRoutes = vi.fn(), clearView = vi.fn();
    goal.update(10); travel.star(); travel.visitSeason('spring');
    Object.assign(scene, { runGoal: goal, travel, starRoutes: { clear: clearRoutes }, goalView: { clear: clearView },
      events: { off: vi.fn() }, input: { off: vi.fn() }, game: { loop: { time: 0 }, canvas: { removeEventListener: vi.fn() } } });
    scene.onShutdown(); goal.update(40); travel.star();
    expect(clearRoutes).toHaveBeenCalledOnce(); expect(clearView).toHaveBeenCalledOnce();
    expect(goal.snapshot()).toMatchObject({ progress: 10, complete: false }); expect(travel.snapshot()).toEqual(new RunTravel().snapshot());
    for (const field of ['starRoutes', 'runGoal', 'goalView', 'travel']) expect((scene as unknown as Record<string, unknown>)[field]).toBeUndefined();
  });
});

describe('content v2 final RunScene integration', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), addEventListener: vi.fn(), removeEventListener: vi.fn(),
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    vi.stubGlobal('document', { getElementById: () => null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(DELIVERY_CHAPTERS)('starts the real $id chapter and preserves its own seed while consuming only deliveryId', chapter => {
    vi.spyOn(deliveryStore, 'load').mockReturnValue({ completedIds: DELIVERY_CHAPTERS.map(item => item.id), saveFailed: false });
    const scene = new RunScene(), set = vi.fn(); Object.assign(scene, { data: { set } });
    const data = { deliveryId: chapter.id, unrelated: 'retained' }; scene.init(data);
    const route = (scene as unknown as { delivery: DeliveryRoute }).delivery;
    expect(route).toBeInstanceOf(DeliveryRoute); expect(route.chapter.id).toBe(chapter.id); expect(route.chapter.seed).toBe(chapter.seed);
    expect(set).toHaveBeenLastCalledWith('delivery-id', chapter.id); expect(data).toEqual({ unrelated: 'retained' });
    scene.init(data);
    expect((scene as unknown as { delivery?: DeliveryRoute }).delivery).toBeUndefined(); expect(set).toHaveBeenLastCalledWith('delivery-id', null);
  });

  it.each([undefined, 'unknown-chapter', ''])('keeps absent or invalid chapter ID %s in endless mode', deliveryId => {
    const scene = new RunScene(), set = vi.fn(); Object.assign(scene, { data: { set } });
    const data = { deliveryId }; scene.init(data);
    expect((scene as unknown as { delivery?: DeliveryRoute }).delivery).toBeUndefined();
    expect(set).toHaveBeenCalledExactlyOnceWith('delivery-id', null); expect(Object.hasOwn(data, 'deliveryId')).toBe(false);
  });

  it.each(DELIVERY_CHAPTERS)('settles $id once using the actual chapter ID and never the endless journal or currency path', chapter => {
    vi.spyOn(deliveryStore, 'load').mockReturnValue({ completedIds: DELIVERY_CHAPTERS.map(item => item.id), saveFailed: false });
    const complete = vi.spyOn(deliveryStore, 'complete').mockReturnValue({ added: true, saved: true });
    const scene = makeScene(); primeUpdate(scene);
    const route = new DeliveryRoute(chapter.id); route.distance = chapter.length; route.state = 'ending'; route.endingMs = chapter.endingDurationMs - 40;
    const finishScore = vi.fn(), finishJourney = vi.fn(), panel = vi.fn();
    const goal = new RunGoal({ random: () => .9 }), travel = new RunTravel();
    Object.assign(scene, { delivery: route, runGoal: goal, travel,
      environmentSystem: {update:vi.fn(),setWeather:vi.fn()},
      scoreSystem: { finish: finishScore }, journey: { finish: finishJourney },
      pauseButton: { input: { enabled: true } }, deliveryPanel: { show: panel }, deliveryView: { update: vi.fn() } });
    scene.update(0, 40); scene.update(40, 40);
    expect(route.state).toBe('complete'); expect(scene.finished).toBe(true);
    expect(complete).toHaveBeenCalledExactlyOnceWith(chapter.id);
    if (route.challenge) expect(panel).toHaveBeenCalledExactlyOnceWith('success', false, chapter.id, route.challenge.snapshot());
    else expect(panel).toHaveBeenCalledExactlyOnceWith('success', false, chapter.id);
    expect(finishScore).not.toHaveBeenCalled(); expect(finishJourney).not.toHaveBeenCalled();
    expect(goal.snapshot().progress).toBe(0); expect(travel.snapshot()).toEqual(new RunTravel().snapshot());
    expect(vi.mocked(scene.audioSystem.play).mock.calls.filter(([cue]) => cue === 'bell')).toHaveLength(1);
  });

  it('keeps the dinner chapter identity in the failure panel rather than reopening the original route', () => {
    const scene = makeScene(), route = new DeliveryRoute('dinner-for-you-v1'), panel = vi.fn();
    Object.assign(scene, { delivery: route, deliveryPanel: { show: panel }, deliveryView: { stopCompanion: vi.fn() },
      pauseButton: { input: { enabled: true } }, physics: { pause: vi.fn() }, sheep: { body: { setVelocity: vi.fn() } } });
    scene.onObstacleOverlap(); scene.onObstacleOverlap();
    expect(panel).toHaveBeenCalledExactlyOnceWith('failure', false, 'dinner-for-you-v1'); expect(route.state).toBe('failed');
  });
  it.each(RESIDENT_NEW_CHAPTER_IDS)('rejects direct locked launch %s before initializing gameplay and consumes the stale parameter', deliveryId => {
    vi.spyOn(deliveryStore, 'load').mockReturnValue({ completedIds: [], saveFailed: false });
    vi.spyOn(deliveryChallengeStore, 'retrySave').mockReturnValue({ chapters: {}, saveFailed: false });
    const scene = new RunScene(), start = vi.fn();
    Object.assign(scene, { data: { set: vi.fn() }, scene: { start } });
    const data = { deliveryId }; scene.init(data); scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu, { openMailbox: true });
    expect((scene as unknown as { delivery?: DeliveryRoute }).delivery).toBeUndefined();
    expect(data).toEqual({});
    scene.init(data);
    expect((scene as unknown as { deliveryLocked: boolean }).deliveryLocked).toBe(false);
  });
  it('announces an actual new resident reply once and gives no repeated unlock message on replay', () => {
    const ids: string[] = [];
    vi.spyOn(deliveryStore, 'load').mockImplementation(() => ({ completedIds: [...ids], saveFailed: false }));
    vi.spyOn(deliveryStore, 'complete').mockImplementation(id => { const added = !ids.includes(id); if (added) ids.push(id); return { added, saved: true }; });
    vi.spyOn(deliveryChallengeStore, 'recordResult').mockReturnValue({ accepted: true, improved: true, saved: true });
    for (const replay of [false, true]) {
      const scene = makeScene(); primeUpdate(scene);
      const route = new DeliveryRoute('windmill-invitation-v1'), show = vi.fn();
      route.distance = route.chapter.length; route.state = 'ending'; route.endingMs = route.chapter.endingDurationMs - 40;
      Object.assign(scene, { delivery: route, environmentSystem: { update: vi.fn(), setWeather: vi.fn() },
        pauseButton: { input: { enabled: true } }, deliveryPanel: { show }, deliveryView: { update: vi.fn() } });
      scene.update(0, 40); scene.update(40, 40);
      expect(show).toHaveBeenCalledOnce();
      expect(show.mock.calls[0]![4]).toBe(replay ? undefined : '收到阿禾的回信');
    }
  });

  it('updates landmarks from physical world distance and the current presentation rather than score bonuses', () => {
    const scene = makeScene(); primeUpdate(scene);
    const update = vi.fn(), landscape = { theme: 'summer', weather: 'sunny', weatherAlpha: 0, dayPhase: 'afternoon',
      landTint: 0xffffff, nearOffset: 400, nearRepeatWidth: 480, nearRatio: .24 };
    Object.assign(scene, { scale: { gameSize: { width: 584, height: 270 } }, landmarks: { update, busy: false },
      scoreSystem: { update: vi.fn(), score: 99999, travelledDistancePx: 3456 },
      environmentSystem: { update: vi.fn(), presentation: () => landscape },
      game: { loop: { time: 0 }, canvas: { parentElement: { querySelector: () => null } } } });
    scene.update(0, 5000);
    expect(update).toHaveBeenCalledExactlyOnceWith({ distance: 3456, deltaMs: 40,
      viewport: { width: 584, height: 270 }, landscape, blocked: false });
    Object.assign(scene, { starMilestone: 10 }); scene.update(0, 40);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ distance: 3456, blocked: true }));
  });

  it('connects B onEncounter to the run record without counting the landmark catalog when the scene is created', () => {
    const scene = makeScene();
    const text = vi.fn(() => ({ setOrigin() { return this; }, setTint() { return this; }, setName() { return this; },
      setDepth() { return this; }, setScrollFactor() { return this; }, setVisible() { return this; } }));
    Object.assign(scene, { add: { text, bitmapText: text, existing: vi.fn() }, registry: { get: () => scene.audioSystem, set: vi.fn() },
      physics: { world: { setBounds: vi.fn() }, add: { existing: vi.fn(), group: () => ({ getChildren: () => [] }), overlap: vi.fn() } },
      cameras: { main: { setScroll: vi.fn() } }, input: { on: vi.fn() }, events: { on: vi.fn(), once: vi.fn() },
      scale: { gameSize: { width: 480, height: 270 }, on: vi.fn() }, game: { canvas: { addEventListener: vi.fn() } } });
    (scene as unknown as RunScene).create();
    const runtime = scene as unknown as { travel: RunTravel; landmarks: { options: { onEncounter: (event: LandmarkEncounter) => void } } };
    expect(runtime.travel.snapshot().landmarks).toEqual([]);
    const encounter: LandmarkEncounter = { id: 'windmill-meadow', title: '风车草地', distance: 3000, theme: 'spring' };
    runtime.landmarks.options.onEncounter(encounter); runtime.landmarks.options.onEncounter(encounter);
    expect(runtime.travel.snapshot().landmarks).toEqual(['windmill-meadow']);
  });

  it('clears B landmarks, delivery panel and chapter identity on shutdown', () => {
    const scene = makeScene(), clearLandmarks = vi.fn(), clearPanel = vi.fn();
    Object.assign(scene, { landmarks: { clear: clearLandmarks }, deliveryPanel: { clear: clearPanel }, delivery: new DeliveryRoute('dinner-for-you-v1'),
      events: { off: vi.fn() }, input: { off: vi.fn() }, game: { loop: { time: 0 }, canvas: { removeEventListener: vi.fn() } } });
    scene.onShutdown(); expect(clearLandmarks).toHaveBeenCalledOnce(); expect(clearPanel).toHaveBeenCalledOnce();
    for (const key of ['landmarks', 'deliveryPanel', 'delivery']) expect((scene as unknown as Record<string, unknown>)[key]).toBeUndefined();
  });
});
