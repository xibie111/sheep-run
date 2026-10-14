import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ font: true, image: true, atlas: true, seasonArt: true, resultArt: true, additionalArt: true, newObstacleArt: true, expandedArt: true, animalArt: true, contentDimensions: true, contentPreparation: true, residentDimensions: true, residentPreparation: true }));
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
vi.mock("../data/expandedObstacleArt", async importOriginal => {
  const original = await importOriginal<typeof import("../data/expandedObstacleArt")>();
  return { ...original, createExpandedObstacleTextures: vi.fn(() => { if (!state.expandedArt) throw new Error("invalid expanded obstacle atlas"); }) };
});
vi.mock("../data/skinSpriteAssets", async importOriginal => {
  const original = await importOriginal<typeof import("../data/skinSpriteAssets")>();
  return { ...original, registerSkinRenderFrames: vi.fn(() => { if (!state.atlas) throw new Error("invalid local atlas"); }) };
});
vi.mock("../ambient/animalAssets", async importOriginal => {
  const original = await importOriginal<typeof import("../ambient/animalAssets")>();
  return { ...original, prepareAnimalArt: vi.fn(() => { if (!state.animalArt) throw new Error("invalid animal atlas"); }) };
});
vi.mock("../content-v2", async importOriginal => {
  const original = await importOriginal<typeof import("../content-v2")>();
  return {
    ...original,
    validateContentV2Textures: vi.fn(() => state.contentDimensions ? [] : [original.CONTENT_V2_ASSETS[0]!.key]),
    prepareContentV2Textures: vi.fn(() => { if (!state.contentPreparation) throw new Error("invalid content v2 preparation"); }),
  };
});

import { PreloadScene } from "./PreloadScene";
vi.mock('../residents/residentAssets', async importOriginal => {
  const original = await importOriginal<typeof import('../residents/residentAssets')>();
  return { ...original,
    validateResidentTextures: vi.fn(() => state.residentDimensions ? [] : [original.RESIDENT_ASSETS[0]!.key]),
    prepareResidentTextures: vi.fn(() => { if (!state.residentPreparation) throw new Error('invalid resident art'); }),
  };
});
import { RESIDENT_ASSETS } from '../residents/residentAssets';
import { SCENERY_ASSETS } from '../scenery/sceneryAssets';
import { bindTouchTarget } from "../ui/TouchTarget";
import { SCENE } from "../game/Constants";
import { DISPLAY_FONTS } from "../ui/DisplayText";
import { RESULT_SCORE_FONT } from "../data/resultArtAssets";
import { MAILBOX_ASSETS } from "../data/mailboxAssets";
import { ACHIEVEMENT_ICON_ASSETS } from "../data/achievementIconAssets";
import { RUNNER_V2_ASSETS } from "../runner-v2/runnerAssets";
import { CONTENT_V2_ASSETS, prepareContentV2Textures, validateContentV2Textures } from "../content-v2";
import { EXPANDED_OBSTACLE_ART, createExpandedObstacleTextures, expandedObstacleRuntimeKeys } from "../data/expandedObstacleArt";

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
  const image = vi.fn(), spritesheet = vi.fn(), bitmapFont = vi.fn(), loadOn = vi.fn(), loadOff = vi.fn();
  Object.assign(scene, {
    events: { once: shutdown },
    add: { rectangle: () => object(), text: (_x: number, _y: number, text: string) => object(text), container: () => object() },
    scene: { start, restart },
    textures: { exists: () => state.image, remove: removeTexture, get: () => ({ getSourceImage: () => ({ width: 600, height: 400 }) }) },
    cache: { bitmapFont: { exists: () => state.font, remove: removeFont }, xml: { remove: removeXml } },
    load: { image, spritesheet, bitmapFont, on: loadOn, off: loadOff },
  });
  return { scene, start, restart, objects, removeTexture, removeFont, removeXml, shutdown, image };
}

describe("local asset loading recovery", () => {
  beforeEach(() => {
    state.font = state.image = state.atlas = state.seasonArt = state.resultArt = state.additionalArt = state.newObstacleArt = state.expandedArt = state.animalArt = true;
    state.contentDimensions = state.contentPreparation = true;
    state.residentDimensions = state.residentPreparation = true;
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
    expect(loading.setPreparing.mock.calls.map(args => args[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(loading.setPreparing.mock.calls.every(args => args[1] === 14)).toBe(true);
    expect(createExpandedObstacleTextures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(validateContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(prepareContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(loading.complete).toHaveBeenCalledOnce();
    expect(loading.complete.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]!);
  });

  it.each(["font", "image", "atlas", "seasonArt", "resultArt", "additionalArt", "newObstacleArt", "expandedArt", "animalArt"] as const)("shows a resource-independent touch retry when a local %s fails", async kind => {
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
    expect(loading.setPreparing).toHaveBeenCalledExactlyOnceWith(0, 14);
    expect(objects).toEqual([]);
  });

  it("reports a missing collectible image instead of silently using the old procedural star", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "star");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it.each(['residentDimensions', 'residentPreparation'] as const)('blocks resident %s errors and clears every resident texture for touch retry', async kind => {
    state[kind] = false;
    const { scene, start, restart, removeTexture, objects } = harness();
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.some(object => object.name === 'local-load-error')).toBe(true);
    const retry = vi.mocked(bindTouchTarget).mock.calls.at(-1)![4];
    retry();
    for (const asset of RESIDENT_ASSETS) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(restart).toHaveBeenCalledOnce();
    state[kind] = true;
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
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
    for (const asset of [...RUNNER_V2_ASSETS, ...CONTENT_V2_ASSETS]) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacles-source");
    expect(removeTexture).toHaveBeenCalledWith("season-winter-obstacle-FlyingBird");
    expect(removeTexture).toHaveBeenCalledWith("additional-obstacles-source");
    expect(removeTexture).toHaveBeenCalledWith("obstacle-wide-log");
    expect(removeTexture).toHaveBeenCalledWith("new-obstacles-v2-source");
    expect(removeTexture).toHaveBeenCalledWith(EXPANDED_OBSTACLE_ART.key);
    const expandedKeys = expandedObstacleRuntimeKeys();
    expect(new Set(expandedKeys).size).toBe(20);
    for (const key of expandedKeys) expect(removeTexture).toHaveBeenCalledWith(key);
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
  it("requires the expanded obstacle source before preparation and queues its local image", async () => {
    const { scene, start, objects, image } = harness();
    scene.textures.exists = vi.fn(key => key !== EXPANDED_OBSTACLE_ART.key);
    scene.preload();
    expect(image.mock.calls.filter(([key]) => key === EXPANDED_OBSTACLE_ART.key)).toEqual([
      [EXPANDED_OBSTACLE_ART.key, EXPANDED_OBSTACLE_ART.url],
    ]);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(createExpandedObstacleTextures).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
    expect(bindTouchTarget).toHaveBeenCalledOnce();
    expect(loading.complete).not.toHaveBeenCalled();
  });
  it("clears all expanded obstacle textures after preparation failure and recovers on touch retry", async () => {
    state.expandedArt = false;
    const { scene, start, objects, removeTexture, restart } = harness();
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
    expect(createExpandedObstacleTextures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(loading.complete).not.toHaveBeenCalled();

    state.expandedArt = true;
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    expect(removeTexture).toHaveBeenCalledWith(EXPANDED_OBSTACLE_ART.key);
    const expandedKeys = expandedObstacleRuntimeKeys();
    expect(new Set(expandedKeys).size).toBe(20);
    for (const key of expandedKeys) expect(removeTexture).toHaveBeenCalledWith(key);
    expect(restart).toHaveBeenCalledOnce();
    await scene.create();
    expect(createExpandedObstacleTextures).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
    expect(loading.complete).toHaveBeenCalledOnce();
  });
  it("requires the animal atlas before entering the menu", async () => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== "ambient-life-source");
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it.each(SCENERY_ASSETS)("requires the $key postcard and clears its cache on retry", async asset => {
    const { scene, start, objects, removeTexture } = harness();
    scene.textures.exists = vi.fn(key => key !== asset.key);
    await scene.create(); expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === 'local-load-error')).toBeDefined();
    scene.textures.exists = vi.fn(() => true);
    vi.mocked(bindTouchTarget).mock.calls[0]![4](); expect(removeTexture).toHaveBeenCalledWith(asset.key);
  });
  it('blocks a present but wrongly sized postcard and enters only after resource retry', async () => {
    const { scene, start, objects, removeTexture } = harness();
    scene.textures.get = vi.fn(() => ({ getSourceImage: () => ({ width: 1, height: 400 }) })) as never;
    await scene.create(); expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === 'local-load-error')).toBeDefined();
    scene.textures.get = vi.fn(() => ({ getSourceImage: () => ({ width: 600, height: 400 }) })) as never;
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    for (const asset of SCENERY_ASSETS) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    await scene.create(); expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
  });
  it.each(MAILBOX_ASSETS)("requires mailbox resource $key before entering the menu", async asset => {
    const { scene, start, objects } = harness();
    scene.textures.exists = vi.fn(key => key !== asset.key);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
  });
  it.each(ACHIEVEMENT_ICON_ASSETS)("requires achievement $id and reloads its texture on retry", async asset => {
    const { scene, start, objects, removeTexture, restart } = harness();
    scene.textures.exists = vi.fn(key => key !== asset.key);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
    scene.textures.exists = vi.fn(() => true);
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(restart).toHaveBeenCalledOnce();
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
  });
  it("queues all new runner and content v2 images through the initial loader, preserving their actual local URLs", () => {
    const { scene, image } = harness();
    scene.textures.exists = vi.fn(() => false);
    scene.preload();
    for (const asset of [...RUNNER_V2_ASSETS, ...CONTENT_V2_ASSETS]) {
      expect(image.mock.calls.filter(([key]) => key === asset.key)).toEqual([[asset.key, asset.url]]);
    }
  });
  it("reuses already loaded v2 images rather than issuing duplicate requests", () => {
    const { scene, image } = harness();
    scene.preload();
    for (const asset of [...RUNNER_V2_ASSETS, ...CONTENT_V2_ASSETS]) {
      expect(image.mock.calls.some(([key]) => key === asset.key)).toBe(false);
    }
  });
  it.each([...RUNNER_V2_ASSETS, ...CONTENT_V2_ASSETS])("requires new v2 resource $key and reloads it on touch retry", async asset => {
    const save = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", { localStorage: save });
    const { scene, start, objects, removeTexture, restart } = harness();
    scene.textures.exists = vi.fn(key => key !== asset.key);
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")?.text).toBe("本地资源加载失败");
    expect(loading.complete).not.toHaveBeenCalled();
    scene.textures.exists = vi.fn(() => true);
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(restart).toHaveBeenCalledOnce();
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
    expect(prepareContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(save.getItem).not.toHaveBeenCalled(); expect(save.setItem).not.toHaveBeenCalled(); expect(save.removeItem).not.toHaveBeenCalled();
  });
  it("rejects invalid content dimensions even when texture keys exist, then retries after repaired images", async () => {
    state.contentDimensions = false;
    const { scene, start, objects, removeTexture, restart } = harness();
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
    expect(validateContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(prepareContentV2Textures).not.toHaveBeenCalled();
    state.contentDimensions = true;
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    for (const asset of CONTENT_V2_ASSETS) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(restart).toHaveBeenCalledOnce();
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
    expect(prepareContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
  });
  it("keeps the menu blocked when v2 preparation throws and succeeds only after the repair retry", async () => {
    state.contentPreparation = false;
    const { scene, start, objects, removeTexture, restart } = harness();
    await scene.create();
    expect(start).not.toHaveBeenCalled();
    expect(objects.find(item => item.name === "local-load-error")).toBeDefined();
    expect(prepareContentV2Textures).toHaveBeenCalledExactlyOnceWith(scene);
    expect(loading.complete).not.toHaveBeenCalled();
    state.contentPreparation = true;
    vi.mocked(bindTouchTarget).mock.calls[0]![4]();
    for (const asset of CONTENT_V2_ASSETS) expect(removeTexture).toHaveBeenCalledWith(asset.key);
    expect(restart).toHaveBeenCalledOnce();
    await scene.create();
    expect(start).toHaveBeenCalledExactlyOnceWith(SCENE.menu);
    expect(prepareContentV2Textures).toHaveBeenCalledTimes(2);
    expect(loading.complete).toHaveBeenCalledOnce();
  });
});
