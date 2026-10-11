import { describe, expect, it, vi } from "vitest";
import { PLAYER, RUN, WORLD } from "../game/Constants";
import { EnvironmentSystem } from "./EnvironmentSystem";
import { DifficultySystem } from "../systems/DifficultySystem";
import { InputSystem } from "../systems/InputSystem";
import { ScoreSystem } from "../systems/ScoreSystem";
import { SpawnSystem } from "../systems/SpawnSystemOwner";
import { ProgressionSystem } from "../systems/ProgressionSystem";

function createSceneHarness(width = 480, height = 270) {
  const scene = {
    scale: { gameSize: { width, height }, on() {}, off() {} },
    events: { once() {}, off() {} },
    gameplay: {
      player: { y: WORLD.groundY, body: { width: PLAYER.width, height: PLAYER.height } },
      gravity: PLAYER.gravityY,
      jumpVelocity: PLAYER.jumpVelocityY,
      obstacleBody: { width: 28, height: 30, enabled: true },
      worldSpeed: RUN.initialSpeed,
    },
    add: {
      tileSprite: () => ({
        tilePositionX: 0,
        setOrigin() { return this; },
        setDepth() { return this; },
        setTint() { return this; },
        setScrollFactor() { return this; },
        setPosition() { return this; },
        setSize() { return this; },
        setTexture() { return this; },
        destroy() {},
      }),
      particles: () => ({
        setScrollFactor() { return this; },
        updateConfig() { return this; },
        setDepth() { return this; },
        setAlpha() { return this; },
        start() {},
        stop() {},
        destroy() {},
      }),
      image: () => ({
        setDepth() { return this; },
        setScale() { return this; },
        setFlipX() { return this; },
        setTexture() { return this; },
        setVisible() { return this; },
        setPosition() { return this; },
        setScrollFactor() { return this; },
        destroy() {},
      }),
    },
    physics: {
      add: {
        existing: () => { throw new Error("EnvironmentSystem must not register gameplay physics"); },
      },
      world: { setBounds: () => { throw new Error("EnvironmentSystem must not configure the physics world"); } },
    },
  };
  return scene;
}

describe("EnvironmentSystem", () => {
  it("keeps speed, gesture decisions, spawns, score and saved rewards identical across different weather seeds", () => {
    const trace = (weatherSeed: number) => {
      const storage = new Map<string, string>();
      vi.stubGlobal("window", { localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      } });
      const scene = createSceneHarness();
      const before = structuredClone(scene.gameplay);
      const environment = new EnvironmentSystem(scene as never, { seed: weatherSeed });
      const difficulty = new DifficultySystem();
      const input = new InputSystem();
      const score = new ScoreSystem();
      const spawn = new SpawnSystem(123);
      const gameplay: unknown[] = [], weather: string[] = [];
      for (let frame = 0; frame < 300; frame++) {
        const time = frame * 16;
        if (frame === 30) input.handleGesture({ type: "down", pointerId: 1, x: 100, y: 100, at: time });
        if (frame === 35) input.handleGesture({ type: "up", pointerId: 1, x: 100, y: 100, at: time });
        const speed = difficulty.update(0.016);
        score.update(speed, 16);
        if (frame % 60 === 0) score.awardStar();
        environment.update(frame * 600, 16, score.score);
        weather.push(environment.snapshot().weather);
        gameplay.push({ speed, input: input.update(time, true), spawns: spawn.update(0.016, speed), score: score.score });
      }
      expect(scene.gameplay).toEqual(before);
      const result = score.finish();
      const reward = new ProgressionSystem().awardRun(result.score);
      environment.clear();
      return { weather, gameplay: { frames: gameplay, result, reward, save: [...storage] } };
    };
    try {
      const rain = trace(2), wind = trace(3);
      expect(rain.weather).not.toEqual(wind.weather);
      expect(rain.gameplay).toEqual(wind.gameplay);
    } finally { vi.unstubAllGlobals(); }
  });

  it("switches scenery at score boundaries without changing gameplay or chunk bounds", () => {
    const scene = createSceneHarness();
    const gameplayBefore = structuredClone(scene.gameplay);
    const environment = new EnvironmentSystem(scene as never, { seed: 11 });
    const boundaries = [[1499, "spring"], [1500, "summer"], [3000, "autumn"], [4500, "winter"], [6000, "spring"], [0, "spring"]] as const;
    for (const [score, season] of boundaries) {
      environment.update(8500, 16, score);
      expect(environment.snapshot().theme).toBe(season);
      expect(environment.snapshot().activeChunks).toBeLessThanOrEqual(6);
      expect(scene.gameplay).toEqual(gameplayBefore);
    }
    environment.clear();
  });

  it("composes distance-driven themes, weather, parallax, and bounded chunks", () => {
    const environment = new EnvironmentSystem(createSceneHarness() as never, { seed: 11 });

    for (let frame = 0; frame < 100; frame += 1) {
      const distance = frame * 600;
      environment.update(distance, 16);
      if (frame === 20) {
        environment.setTheme("winter");
        expect(environment.snapshot().theme).toBe("winter");
      }
      if (frame === 40) {
        environment.setTheme(null);
        expect(environment.snapshot().theme).toBe("autumn");
      }
      if (frame === 60) {
        environment.setWeather("wind");
        environment.update(distance, 16);
        expect(environment.snapshot().weather).toBe("wind");
      }
      if (frame === 80) environment.setWeather(null);
      environment.ensureChunks(distance + WORLD.width);
      environment.recycleChunks(distance);
    }

    const snapshot = environment.snapshot();
    expect(snapshot.activeChunks).toBeLessThanOrEqual(6);
    expect(snapshot.generatedChunks).toBeGreaterThan(0);
    expect(snapshot.recycledChunks).toBeGreaterThan(0);
    expect(snapshot.allocatedDecorations).toBeLessThanOrEqual(42);
    expect(snapshot.theme).toMatch(/spring|summer|autumn|winter/);
    expect(snapshot.weather).toMatch(/sunny|rain|wind/);
    environment.clear();
  });

  it("keeps the gameplay invariant snapshot byte-for-byte unchanged after visual churn", () => {
    const scene = createSceneHarness() as typeof createSceneHarness extends () => infer T ? T : never;
    const gameplay = { ...scene.gameplay, player: { ...scene.gameplay.player, body: { ...scene.gameplay.player.body } }, obstacleBody: { ...scene.gameplay.obstacleBody } };
    const before = structuredClone(gameplay);
    const environment = new EnvironmentSystem(scene as never, { seed: 99 });

    for (let frame = 0; frame < 100; frame += 1) {
      environment.update(frame * 700, 16);
      environment.setTheme(frame % 2 === 0 ? "summer" : null);
      environment.setWeather(frame % 3 === 0 ? "rain" : null);
      environment.ensureChunks(frame * 700 + WORLD.width);
      environment.recycleChunks(frame * 700);
    }

    expect(gameplay).toEqual(before);
    expect(scene.gameplay).toEqual({
      player: { y: WORLD.groundY, body: { width: PLAYER.width, height: PLAYER.height } },
      gravity: PLAYER.gravityY,
      jumpVelocity: PLAYER.jumpVelocityY,
      obstacleBody: { width: 28, height: 30, enabled: true },
      worldSpeed: RUN.initialSpeed,
    });
    expect(WORLD.groundY).toBe(218);
    environment.clear();
  });

  it("covers the live viewport width with bounded chunks and recycles after a resize", () => {
    const scene = createSceneHarness(584, 270);
    const gameplayBefore = structuredClone(scene.gameplay);
    const environment = new EnvironmentSystem(scene as never, { seed: 11 });
    environment.update(400);
    expect(environment.snapshot().activeChunks).toBe(6);

    scene.scale.gameSize = { width: 480, height: 360 };
    environment.update(400);
    expect(environment.snapshot().activeChunks).toBe(5);
    expect(environment.snapshot().recycledChunks).toBe(1);

    scene.scale.gameSize = { width: 960, height: 270 };
    environment.update(400);
    expect(environment.snapshot().activeChunks).toBe(6);
    for (let frame = 1; frame <= 100; frame += 1) {
      environment.update(400 + frame * 600, 16);
      expect(environment.snapshot().activeChunks).toBeLessThanOrEqual(6);
      expect(environment.snapshot().allocatedDecorations).toBeLessThanOrEqual(42);
    }
    expect(scene.gameplay).toEqual(gameplayBefore);

    environment.clear();
    const cleared = environment.snapshot();
    expect(cleared.activeChunks).toBe(0);
    expect(cleared.pooledDecorations).toBe(0);
    environment.update(90000);
    environment.ensureChunks(90960);
    environment.recycleChunks(90000);
    expect(environment.snapshot()).toEqual(cleared);
  });
});
