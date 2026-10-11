import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {},
    Input: { Events: { POINTER_DOWN: "pointerdown" }, Keyboard: { Events: { ANY_KEY_DOWN: "keydown" } } },
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
  },
}));

vi.mock("../ui/SceneButton", () => ({ addSceneButton: vi.fn() }));

import { PauseScene } from "./PauseScene";
import { SCENE } from "../game/Constants";
import type { AudioSystem } from "../systems/AudioSystem";

type PauseHarness = {
  scene: {
    resume: (key: string) => void;
    stop: (key: string) => void;
    start: (key: string) => void;
  };
  audioSystem: AudioSystem;
  resumeRun: () => void;
  restartRun: () => void;
};

function makePauseScene(): PauseHarness {
  const scene = Object.create(PauseScene.prototype) as PauseHarness;
  scene.scene = { resume: vi.fn(), stop: vi.fn(), start: vi.fn() };
  scene.audioSystem = { play: vi.fn(), initializeAfterGesture: vi.fn(() => true) } as unknown as AudioSystem;
  return scene;
}

describe("PauseScene controls", () => {
  it('retains the delivery route on retry and returns to its mailbox on exit', () => {
    const scene = makePauseScene() as PauseHarness & { returnToMenu: () => void };
    Object.assign(scene, { returnScene: SCENE.run });
    Object.assign(scene.scene, { get: () => ({ data: { get: () => 'hill-goodnight-v1' } }) });
    scene.restartRun();
    expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.run, { deliveryId: 'hill-goodnight-v1' });
    scene.returnToMenu(); expect(scene.scene.start).toHaveBeenLastCalledWith(SCENE.menu, { openMailbox: true });
  });
  it("does not reuse menu settings launch data when pausing a later run", () => {
    const scene = makePauseScene() as PauseHarness & { init: (data: object) => void };
    Object.assign(scene.scene, { isPaused: vi.fn((key: string) => key === SCENE.run) });
    scene.init({ returnScene: SCENE.menu });
    scene.resumeRun();
    expect(scene.scene.resume).toHaveBeenCalledWith(SCENE.run);
  });
  it("resumes the run and closes the pause scene", () => {
    const scene = makePauseScene();

    scene.resumeRun();

    expect(scene.audioSystem.initializeAfterGesture).toHaveBeenCalledOnce();
    expect(scene.audioSystem.play).toHaveBeenCalledWith("button");
    expect(scene.scene.resume).toHaveBeenCalledWith(SCENE.run);
    expect(scene.scene.stop).toHaveBeenCalledWith(SCENE.pause);
  });

  it("returns from a paused run to the menu", () => {
    const scene = makePauseScene() as PauseHarness & { returnToMenu: () => void };

    scene.returnToMenu();

    expect(scene.audioSystem.play).toHaveBeenCalledWith("button");
    expect(scene.scene.stop).toHaveBeenCalledWith(SCENE.run);
    expect(scene.scene.stop).toHaveBeenCalledWith(SCENE.pause);
    expect(scene.scene.start).toHaveBeenCalledWith(SCENE.menu);
  });
});
