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
  const image = vi.fn(() => ({ setDisplaySize() { return this; }, setDepth() { return this; }, setVisible() { return this; }, setScrollFactor() { return this; } }));
  const text = vi.fn(() => ({ setOrigin() { return this; }, setTint() { return this; }, setDepth() { return this; }, setVisible() { return this; }, setText() { return this; }, setScrollFactor() { return this; } }));
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
    const spawn = vi.fn(); Object.assign(scene, { delivery: route, spawnSystem: { update: spawn }, deliveryView: { update: vi.fn() } });
    scene.update(0, 20); scene.onStarOverlap({}); scene.onPowerUpOverlap({});
    expect(route.distance).toBeGreaterThan(0); expect(normal.update).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
  it('fails once without endless rewards, and clears the visual friend immediately', () => {
    const scene = makeScene(), route = new DeliveryRoute(), finish = vi.fn(), panel = vi.fn(), friend = vi.fn();
    Object.assign(scene, { delivery: route, scoreSystem: { finish }, physics: { pause: vi.fn() }, sheep: { body: { setVelocity: vi.fn() } },
      deliveryPanel: { show: panel }, deliveryView: { stopCompanion: friend }, pauseButton: { input: { enabled: true } } });
    scene.onObstacleOverlap(); scene.onObstacleOverlap();
    expect(route.state).toBe('failed'); expect(panel).toHaveBeenCalledExactlyOnceWith('failure'); expect(friend).toHaveBeenCalledOnce();
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
    expect(image).toHaveBeenCalledWith(172, 54, "powerup-shield");
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
      delivery: { state: 'running', distance: 0, advance: () => [] }, obstacles: { getChildren: () => [obstacle] } });
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
    "spawns every request beyond the current %sx%s visible edge without changing its motion",
    (width, height) => {
      const scene = makeScene();
      const obstacle = { activate: vi.fn() };
      const star = { activate: vi.fn() };
      const powerUp = { activate: vi.fn() };
      const update = vi.fn(() => [
        { type: "obstacle", definition: OBSTACLE_DEFINITIONS[0], phase: 0.3 },
        { type: "star", y: 132, phase: 0.6 },
        { type: "powerUp", powerUp: "shield", y: 138, phase: 0.9 },
      ]);
      Object.assign(scene, {
        scale: { gameSize: { width, height } }, spawnSystem: { update },
        difficultySystem: { speed: 190 },
        obstacles: { getChildren: () => [] },
        acquireObstacle: vi.fn(() => obstacle), acquireStar: vi.fn(() => star), acquirePowerUp: vi.fn(() => powerUp),
      });

      scene.spawnObjects(0.04);

      expect(update).toHaveBeenCalledExactlyOnceWith(0.04, 190);
      const visibleRight = runViewportRight({ width, height });
      expect(obstacle.activate).toHaveBeenCalledWith(visibleRight + 18, 0.3, 190, "spring");
      expect(star.activate).toHaveBeenCalledWith(visibleRight + 14, 132, 0.6, 190);
      expect(powerUp.activate).toHaveBeenCalledWith(visibleRight + 14, 138, "shield", 0.9, 190);
      expect(visibleRight + runViewportOrigin({ width, height }).x).toBe(width);
      expect(visibleRight - PLAYER.x).toBe(WORLD.width - PLAYER.x);

      scene.scale.gameSize.width = 584;
      scene.spawnObjects(0.04);
      expect(obstacle.activate).toHaveBeenLastCalledWith(498, 0.3, 190, "spring");
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
      version: 4, highScore: 0, totalStars: 9, coins: 12, selectedSkin: "black", unlockedSkins: ["white", "black"],
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
