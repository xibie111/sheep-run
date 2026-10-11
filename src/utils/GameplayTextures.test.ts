import { describe, expect, it, vi } from "vitest";

const textureProbe = vi.hoisted(() => ({ keys: [] as string[], dimensions: [] as Array<[number, number]> }));
vi.mock("phaser", () => ({ default: {} }));
vi.mock("./TextureUtils", () => ({
  addCanvasTexture: vi.fn((_scene: unknown, key: string, canvas: { width: number; height: number }) => {
    textureProbe.keys.push(key);
    textureProbe.dimensions.push([canvas.width, canvas.height]);
  }),
  removeConnectedLightBackground: vi.fn(),
}));

import { SHEEP_SKINS } from "../data/sheepSkins";
import { createPowerUpTextures, createSheepAnimations, createSheepSpritesheets } from "./GameplayTextures";

const expected = SHEEP_SKINS.flatMap((skin) => {
  const keyPrefix = skin.id === "white" ? "sheep" : `sheep-${skin.id}`;
  return [
    [`${keyPrefix}-idle`, 0, 0, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-run`, 1, 4, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-jump`, 5, 5, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-fall`, 6, 6, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-hit`, 7, 7, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-dash`, 8, 8, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
    [`${keyPrefix}-dead`, 9, 9, skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`],
  ] as const;
});

describe("generated skin texture atlases", () => {
  it("creates each skin spritesheet from its data palette", () => {
    const appliedColors: string[] = [];
    let fillStyle = "";
    const context = {
      fillRect: vi.fn(() => appliedColors.push(fillStyle)),
      set fillStyle(value: string) { fillStyle = value; },
      get fillStyle() { return fillStyle; },
    };
    const document = { createElement: vi.fn(() => ({ width: 0, height: 0, getContext: () => context })) };
    const addCanvas = vi.fn((key: string) => ({ key }));
    const addSpriteSheet = vi.fn((_key: string, source: { key: string }) => source);
    const scene = { textures: { exists: vi.fn(() => false), addCanvas, addSpriteSheet } } as never;
    vi.stubGlobal("document", document);

    expect(typeof createSheepSpritesheets).toBe("function");
    if (!createSheepSpritesheets) return;
    createSheepSpritesheets(scene);

    expect(addCanvas.mock.calls.map(([key]) => key)).toEqual(SHEEP_SKINS.map((skin) => skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`));
    expect(addSpriteSheet).toHaveBeenCalledTimes(SHEEP_SKINS.length);
    for (const skin of SHEEP_SKINS) expect(appliedColors).toContain(skin.palette.wool);
    vi.unstubAllGlobals();
  });
});

describe("registered sheep animations", () => {
  it("uses the production pose order for every generated skin", () => {
    const create = vi.fn();
    const generateFrameNumbers = vi.fn();
    const scene = {
      textures: { getFrame: vi.fn(() => ({ width: 128 })) },
      anims: { exists: vi.fn(() => false), create, generateFrameNumbers },
    } as never;
    createSheepAnimations(scene);
    for (const skin of SHEEP_SKINS) {
      const sourceKey = skin.id === "white" ? "sheep-runner" : `sheep-runner-${skin.id}`;
      expect(generateFrameNumbers).toHaveBeenCalledWith(sourceKey, { frames: [1, 2, 3, 4, 11, 12] });
      expect(generateFrameNumbers).toHaveBeenCalledWith(sourceKey, { frames: [5] });
      expect(generateFrameNumbers).toHaveBeenCalledWith(sourceKey, { frames: [7] });
      expect(generateFrameNumbers).toHaveBeenCalledWith(sourceKey, { frames: [9, 14] });
    }
  });
  it("creates every state animation from its assigned spritesheet frames", () => {
    const create = vi.fn();
    const generateFrameNumbers = vi.fn((_key: string, range: { start: number; end: number }) => range);
    const scene = {
      anims: {
        exists: vi.fn(() => false),
        create,
        generateFrameNumbers,
      },
    } as never;

    createSheepAnimations(scene);

    expect(create).toHaveBeenCalledTimes(expected.length);
    for (const [index, [key, start, end, sourceKey]] of expected.entries()) {
      expect(create.mock.calls[index][0]).toMatchObject({ key, frameRate: expect.any(Number), repeat: expect.any(Number) });
      expect(generateFrameNumbers.mock.calls[index]).toEqual([sourceKey, { start, end }]);
    }
  });

  it("does not replace animation keys already owned by Phaser", () => {
    const create = vi.fn();
    const anims = { exists: vi.fn(() => true), create, generateFrameNumbers: vi.fn() };
    const scene = { anims } as never;

    createSheepAnimations(scene);

    expect(create).not.toHaveBeenCalled();
    expect(anims.generateFrameNumbers).not.toHaveBeenCalled();
  });
});

describe("generated PowerUp textures", () => {
  it("registers one visibly drawn texture per configured pickup type", () => {
    textureProbe.keys.length = 0;
    textureProbe.dimensions.length = 0;
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    };
    const document = { createElement: vi.fn(() => ({ width: 0, height: 0, getContext: () => context })) };
    vi.stubGlobal("document", document);
    const scene = { textures: { exists: vi.fn(() => false) } } as never;

    createPowerUpTextures(scene);

    expect(textureProbe.keys).toEqual([
      "powerup-magnet",
      "powerup-shield",
      "powerup-starMultiplier",
      "powerup-dash",
    ]);
    expect(textureProbe.dimensions).toEqual(Array.from({ length: 4 }, () => [24, 24]));
    expect(context.fillRect.mock.calls.length + context.fill.mock.calls.length).toBeGreaterThan(4);
    vi.unstubAllGlobals();
  });
});
