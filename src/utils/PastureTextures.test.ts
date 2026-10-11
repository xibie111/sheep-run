import { afterEach, describe, expect, it, vi } from "vitest";

type PaintContextProbe = {
  imageSmoothingEnabled: boolean;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  fillRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
};

type CanvasProbe = { width: number; height: number; getContext: (kind: string) => PaintContextProbe };
type TextureFrameProbe = { x: number; y: number; width: number; height: number };
type TextureMetadataProbe = {
  firstFrame: string;
  frames: Map<string, TextureFrameProbe>;
  has: (name: string) => boolean;
  add: (name: string, sourceIndex: number, x: number, y: number, width: number, height: number) => void;
  get: (name?: string) => TextureFrameProbe | undefined;
};

const textureProbe = vi.hoisted(() => ({
  keys: [] as string[],
  registered: new Set<string>(),
  metadata: new Map<string, TextureMetadataProbe>(),
}));
vi.mock("phaser", () => ({ default: {} }));
vi.mock("./TextureUtils", () => ({
  addCanvasTexture: vi.fn((_scene: unknown, key: string, canvas: CanvasProbe) => {
    textureProbe.keys.push(key);
    textureProbe.registered.add(key);
    const metadata: TextureMetadataProbe = {
      firstFrame: "__BASE",
      frames: new Map([["__BASE", { x: 0, y: 0, width: canvas.width, height: canvas.height }]]),
      has(name) { return this.frames.has(name); },
      add(name, _sourceIndex, x, y, width, height) {
        if (this.has(name)) return;
        this.frames.set(name, { x, y, width, height });
        // Phaser Texture.add chooses the first named frame as its default.
        if (this.firstFrame === "__BASE") this.firstFrame = name;
      },
      get(name) { return this.frames.get(name || this.firstFrame); },
    };
    textureProbe.metadata.set(key, metadata);
  }),
}));

import { createPastureTextures } from "./PastureTextures";

afterEach(() => {
  vi.unstubAllGlobals();
  textureProbe.keys.length = 0;
  textureProbe.registered.clear();
  textureProbe.metadata.clear();
});

function createTextureFactoryHarness() {
  const document = {
    createElement: vi.fn(() => {
      const context: PaintContextProbe = {
        imageSmoothingEnabled: true,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
      };
      return { width: 0, height: 0, getContext: () => context };
    }),
  };
  vi.stubGlobal("document", document);
  const scene = { textures: {
    exists: (key: string) => textureProbe.registered.has(key),
    get: (key: string) => textureProbe.metadata.get(key),
  } } as never;
  return { document, scene };
}

describe("cached pasture atmosphere textures", () => {
  it("registers cached layers and separate collision-free decoration textures once", () => {
    const { document, scene } = createTextureFactoryHarness();

    createPastureTextures(scene);
    const firstCreationCount = document.createElement.mock.calls.length;
    createPastureTextures(scene);

    expect(textureProbe.keys).toEqual(expect.arrayContaining([
      "pasture-sky",
      "pasture-cloud",
      "pasture-far-mountain",
      "pasture-treeline",
      "pasture-building",
      "pasture-field",
      "pasture-fence",
      "pasture-ground",
      "pasture-foreground-grass",
      "pasture-weather-rain",
      "pasture-weather-leaf",
      "farm-static",
      "fence",
      "star",
      "environment-tree",
      "environment-flower",
      "environment-fence-decoration",
      "environment-barn",
      "environment-hay-bale",
      "environment-barrel",
      "environment-rock-decoration",
    ]));
    expect(textureProbe.keys).not.toContain("ground-pattern");
    expect(textureProbe.keys).not.toContain("farm-cloud");
    expect(new Set(textureProbe.keys).size).toBe(textureProbe.keys.length);
    expect(document.createElement).toHaveBeenCalledTimes(firstCreationCount);
    expect(firstCreationCount).toBeGreaterThanOrEqual(19);
    const canvases = document.createElement.mock.results.map(({ value }) => value as CanvasProbe);
    expect(canvases.every((canvas) => canvas.getContext("2d").imageSmoothingEnabled === false)).toBe(true);
  });

  it("keeps the generated ground texture on the fixed horizontal ground baseline", () => {
    const { document, scene } = createTextureFactoryHarness();
    createPastureTextures(scene);
    const textureIndex = textureProbe.keys.indexOf("pasture-ground");
    const canvas = document.createElement.mock.results[textureIndex]?.value as CanvasProbe;
    const ground = canvas.getContext("2d");

    expect(ground.fillRect.mock.calls.map(([, y]) => y)).toEqual([218, 218, 229, 229]);
  });

  it("retains the complete cloud default frame after menu subframes and repeated scene visits", () => {
    const { document, scene } = createTextureFactoryHarness();
    createPastureTextures(scene);
    const clouds = textureProbe.metadata.get("pasture-cloud")!;
    const beforeMenu = clouds.get();
    const canvasCount = document.createElement.mock.calls.length;

    clouds.add("ui-cloud", 0, 18, 42, 58, 19);

    expect(clouds.get()).toEqual({ x: 0, y: 0, width: 480, height: 270 });
    expect(clouds.get()).toEqual(beforeMenu);
    expect(clouds.get("ui-cloud")).toEqual({ x: 18, y: 42, width: 58, height: 19 });
    const frameCount = clouds.frames.size;
    createPastureTextures(scene);
    expect(clouds.get()).toEqual(beforeMenu);
    expect(clouds.frames.size).toBe(frameCount);
    expect(document.createElement).toHaveBeenCalledTimes(canvasCount);
  });

  it("aligns repeating landscape motifs to each 480 px texture seam", () => {
    const { document, scene } = createTextureFactoryHarness();
    createPastureTextures(scene);
    const context = (key: string): PaintContextProbe => {
      const textureIndex = textureProbe.keys.indexOf(key);
      const canvas = document.createElement.mock.results[textureIndex]?.value as CanvasProbe | undefined;
      if (!canvas) throw new Error(`Missing canvas probe for ${key}`);
      return canvas.getContext("2d");
    };

    const mountainStarts = context("pasture-far-mountain").moveTo.mock.calls.map(([x]) => x);
    const treeLineStarts = context("pasture-treeline").moveTo.mock.calls.map(([x]) => x);
    const cropStarts = context("pasture-field").fillRect.mock.calls
      .filter(([, y]) => y === 204)
      .map(([x]) => x);
    const fencePosts = context("pasture-fence").fillRect.mock.calls
      .filter(([, y, width, height]) => y === 192 && width === 5 && height === 22)
      .map(([x]) => x);
    const foregroundTufts = context("pasture-foreground-grass").fillRect.mock.calls
      .filter(([, y, width, height]) => y === 211 && width === 2 && height === 8)
      .map(([x]) => x);

    expect(mountainStarts).toEqual([0, 160, 320]);
    expect(treeLineStarts).toEqual([0, 120, 240, 360]);
    expect(cropStarts).toEqual([11, 51, 91, 131, 171, 211, 251, 291, 331, 371, 411, 451]);
    expect(fencePosts).toEqual([40, 120, 200, 280, 360, 440]);
    expect(foregroundTufts).toEqual([8, 48, 88, 128, 168, 208, 248, 288, 328, 368, 408, 448]);
  });
});
