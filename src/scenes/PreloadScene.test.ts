import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ font: true, image: true, atlas: true, seasonArt: true, resultArt: true, additionalArt: true, newObstacleArt: true, animalArt: true }));
vi.mock("phaser", () => ({ default: { Scene: class Scene {} } }));
vi.mock("../game/Viewport", () => ({ watchViewport: (_scene: unknown, layout: (size: object) => void) => layout({ width: 584, height: 270 }) }));
vi.mock("../ui/TouchTarget", () => ({ bindTouchTarget: vi.fn() }));
const loading = vi.hoisted(() => ({ setProgress: vi.fn(), setPreparing: vi.fn(), complete: vi.fn(), hide: vi.fn() }));
vi.mock("../ui/LoadingScreen", () => ({ showLoadingScreen: () => loading, hideLoadingScreen: loading.hide }));
vi.mock("../utils/GameplayTextures", () => ({ createGameplayTextures: vi.fn() }));
vi.mock("../utils/PastureTextures", () => ({ createPastureTextures: vi.fn() }));
vi.mock("../utils/SeasonArtTextures", async importOriginal => {
  const original = await importOriginal<typeof import("../utils/SeasonArtTextures")>();
  return { ...original, createSeasonArtTextures: vi.fn(() => { if (!state.seasonArt) throw new Error("invalid seasonal atlas"); }) };
});
vi.mock("../ui/PauseDialog", () => ({ registerPauseDialogFrames: vi.fn() }));
vi.mock("../data/additionalObstacleArt", async importOriginal => {
  const original = await importOriginal<typeof import("../data/additionalObstacleArt")>();
  return { ...original, createAdditionalObstacleTextures: vi.fn(() => { if (!state.additionalArt) throw new Error("invalid additional obstacle atlas"); }) };
});
vi.mock("../data/resultArtAssets", async importOriginal => {
  const original = await importOriginal<typeof import("../data/resultArtAssets")>();
  return { ...original, createResultArtTextures: vi.fn(() => { if (!state.resultArt) throw new Error("invalid result atlas"); }) };
});
vi.mock("../data/newObstacleArt", async importOriginal => {
  const original = await importOriginal<typeof import("../data/newObstacleArt")>();
  return { ...original, createNewObstacleTextures: vi.fn(() => { if (!state.newObstacleArt) throw new Error("invalid new obstacle atlas"); }) };
});
vi.mock("../data/skinSpriteAssets", async importOriginal => {
  const original = await importOriginal<typeof import("../data/skinSpriteAssets")>();
  return { ...original, registerSkinRenderFrames: vi.fn(() => { if (!state.atlas) throw new Error("invalid local atlas"); }) };
});
vi.mock("../ambient/animalAssets", async importOriginal => {
  const original = await importOriginal<typeof import("../ambient/animalAssets")>();
  return { ...original, prepareAnimalArt: vi.fn(() => { if (!state.animalArt) throw new Error("invalid animal atlas"); }) };
});

import { PreloadScene } from "./PreloadScene";
import { bindTouchTarget } from "../ui/TouchTarget";
import { SCENE } from "../game/Constants";
import { DISPLAY_FONTS } from "../ui/DisplayText";
import { RESULT_SCORE_FONT } from "../data/resultArtAssets";
import { MAILBOX_ASSETS } from "../data/mailboxAssets";

function harness() {
  const objects: Array<{ name: string; text: string }> = [];
  const object = (text = "") => {
    const value = {
      name: "", text,
      setOrigin() { return this; },
      setName(name: string) { this.name = name; return this; },
      setPosition() { return this; }, setSize() { return this; }, setAlpha() { return this; },
    };
    objects.push(value);
    return value;
  };
  const scene = new PreloadScene();
  const start = vi.fn(), restart = vi.fn(), removeTexture = vi.fn(), removeFont = vi.fn(), removeXml = vi.fn();
  const shutdown = vi.fn();
  Object.assign(scene, {
    events: { once: shutdown },
    add: { rectangle: () => object(), text: (_x: number, _y: number, text: string) => object(text), container: () => object() },
    scene: { start, restart },
    textures: { exists: () => state.image, remove: removeTexture },
    cache: { bitmapFont: { exists: () => state.font, remove: removeFont }, xml: { remove: removeXml } },
  });
  return { scene, start, restart, objects, removeTexture, removeFont, removeXml, shutdown };
}

describe("local asset loading recovery", () => {
  beforeEach(() => {
    state.font = state.image = state.atlas = state.seasonArt = state.resultArt = state.additionalArt = state.newObstacleArt = state.animalArt = true;
    vi.clearAllMocks();
    vi.stubGlobal("document", { getElementById: () => null });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reports completed preparation jobs and only then starts the game", async () => {
    const { scene, start, objects } = harness();
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
    expect(objects).toEqual([]);
    expect(loading.setPreparing.mock.calls.map(args => args[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(loading.complete).toHaveBeenCalledOnce();
    expect(loading.complete.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]!);
  });

  it.each(["font", "image", "atlas", "seasonArt", "resultArt", "additionalArt", "newObstacleArt", "animalArt"] as const)("shows a resource-independent touch retry when a local %s fails", async kind => {
    state[kind] = false;
    const { scene, start, objects } = harness();
    await expect(scene.create()).resolves.toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")?.text).toBe("本地资源加载失败");
    expect(objects.find(item => item.text === "重试")).toBeDefined();
    expect(bindTouchTarget).toHaveBeenCalledOnce();
    expect(loading.complete).not.toHaveBeenCalled();
  });

  it("cancels preparation after scene shutdown without hiding a newer loading screen", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return 1; });
    const { scene, shutdown, start, objects } = harness();
    const preparation = scene.create();
    shutdown.mock.calls[0]![1]();
    frames.shift()!(0);
    await preparation;
    expect(start).not.toHaveBeenCalled();
    expect(loading.hide).not.toHaveBeenCalled();
    expect(loading.complete).not.toHaveBeenCalled();
    expect(loading.setPreparing).toHaveBeenCalledExactlyOnceWith(0, 11);
    expect(objects).toEqual([]);
  });

  it("reports a missing collectible image instead of silently using the old procedural star", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "star");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it.each(["spring", "summer", "autumn", "winter"])("requires the %s permanent reward artwork", async season => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== `journey-${season}`);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });

  it("clears owned asset caches and retries without changing the local save", async () => {
    state.atlas = false;
    const save = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", { localStorage: save });
    const { scene, restart, removeTexture, removeFont, removeXml } = harness();
    await scene.create();
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();

    expect(restart).toHaveBeenCalledOnce();
    expect(removeTexture).toHaveBeenCalledWith("sheep-runner");
    expect(removeTexture).toHaveBeenCalledWith("star");
    expect(removeTexture).toHaveBeenCalledWith("companion-sheep-bell");
    expect(removeTexture).toHaveBeenCalledWith("mailbox-v1");
    for (const asset of MAILBOX_ASSETS) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacles-source");
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacle-FlyingBird");
    expect(removeTexture).toHaveBeenCalledWith("additional-obstacles-source");
    expect(removeTexture).toHaveBeenCalledWith("obstacle-wide-log");
    expect(removeTexture).toHaveBeenCalledWith("new-obstacles-v2-source");
    expect(removeTexture).toHaveBeenCalledWith("ambient-life-source");
    expect(removeTexture).toHaveBeenCalledWith("ambient-life-atlas");
    expect(removeTexture).toHaveBeenCalledWith("obstacle-wood-barrel");
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacle-HangingBranch");
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacle-HangingVine");
    expect(removeTexture).toHaveBeenCalledWith("result-art-panel");
    expect(removeTexture).toHaveBeenCalledWith("result-controls-source");
    for (const font of [...Object.values(DISPLAY_FONTS), RESULT_SCORE_FONT]) {
      expect(removeFont).toHaveBeenCalledWith(font.key);
      expect(removeXml).toHaveBeenCalledWith(font.key);
    }
    expect(save.getItem).not.toHaveBeenCalled();
    expect(save.setItem).not.toHaveBeenCalled();
    expect(save.removeItem).not.toHaveBeenCalled();
  });

  it("refuses to enter the menu if the companion bell asset is missing", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "companion-sheep-bell");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it("requires the new four-season obstacle atlas before entering the menu", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "new-obstacles-v2-source");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it("requires the animal atlas before entering the menu", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "ambient-life-source");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it.each(['rainbow', 'meteors', 'fireflies'])("requires the %s postcard and clears its cache on retry", async id => {
    const { scene, start, objects, removeTexture } = harness();
    scene.textures.exists = vi.fn(key => key !== `scenery-${id}`);
    await scene.create(); expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === 'local-load-error')).toBeDefined();
    scene.textures.exists = vi.fn(() => true);
    vi.mocked(bindTouchTarget).mock.calls[0]![4](); expect(removeTexture).toHaveBeenCalledWith(`scenery-${id}`);
  });
  it.each(MAILBOX_ASSETS)("requires mailbox resource $key before entering the menu", async asset => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== asset.key);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
});
