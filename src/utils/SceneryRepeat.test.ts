import { afterEach, describe, expect, it, vi } from "vitest";
import { createSceneryRepeat, joinSceneryPixels, retainGroundConnectedAlpha, matchScenerySky, matchSceneryRoad } from "./SceneryRepeat";
import { WORLD } from "../game/Constants";

class PixelCanvas {
  width = 0;
  height = 0;
  pixels: Uint8ClampedArray = new Uint8ClampedArray();
  getContext() {
    return {
      imageSmoothingEnabled: true,
      drawImage: (source: PixelCanvas) => { this.pixels = new Uint8ClampedArray(source.pixels); },
      getImageData: () => ({ data: new Uint8ClampedArray(this.pixels) }),
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => { this.pixels = image.data; },
    };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("forward-facing scenery repeat", () => {
  it("matches clear upper sky while preserving opaque clouds and lower landscape colors", () => {
    const reference = new Uint8ClampedArray(120 * 4), target = new Uint8ClampedArray(120 * 4);
    for (let y = 0; y < 120; y++) { reference.set([40, 160, 230, 255], y * 4); target.set([15, 140, 225, 255], y * 4); }
    target.set([245, 250, 255, 255], 20 * 4);
    matchScenerySky(target, 1, reference, 1, 120);
    expect([...target.subarray(0, 4)]).toEqual([40, 160, 230, 255]);
    expect([...target.subarray(80, 84)]).toEqual([245, 250, 255, 255]);
    expect([...target.subarray(440, 444)]).toEqual([15, 140, 225, 255]);
  });
  it("uses the complete authored extension once instead of alternating small crops", () => {
    vi.stubGlobal("document", { createElement: () => new PixelCanvas() });
    const source = new PixelCanvas(), extra = new PixelCanvas();
    source.width = 480; extra.width = 640; source.height = extra.height = 270;
    source.pixels = new Uint8ClampedArray(480 * 270 * 4);
    extra.pixels = new Uint8ClampedArray(640 * 270 * 4);
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) source.pixels.set([40, 150, 70, 255], (y * 480 + x) * 4);
      for (let x = 0; x < 640; x++) extra.pixels.set(x >= 280 && x < 310 && y < 180 ? [190, 80, 200, 255] : [40, 150, 70, 255], (y * 640 + x) * 4);
    }
    const result = createSceneryRepeat(source as unknown as CanvasImageSource, "near", extra as unknown as HTMLCanvasElement) as unknown as PixelCanvas;
    expect(result.width).toBe(1024);
    let landmarks = 0;
    for (let i = 0; i < result.pixels.length; i += 4) if (result.pixels[i] === 190) landmarks++;
    expect(landmarks).toBe(30 * 180);
  });

  it("matches the road palette while preserving trees, hard alpha and stone contrast", () => {
    const reference = new Uint8ClampedArray(270 * 2 * 4), incoming = new Uint8ClampedArray(reference.length);
    for (let y = 0; y < 270; y++) for (let x = 0; x < 2; x++) {
      reference.set([170 + x * 20, 140 + x * 20, 70 + x * 20, 255], (y * 2 + x) * 4);
      incoming.set([150 + x * 20, 100 + x * 20, 50 + x * 20, 255], (y * 2 + x) * 4);
    }
    const untouchedTrees = incoming.slice(0, (WORLD.groundY - 4) * 2 * 4);
    matchSceneryRoad(incoming, 2, reference, 2, 270);
    expect(incoming.slice(0, untouchedTrees.length)).toEqual(untouchedTrees);
    expect(incoming.slice(240 * 2 * 4, 241 * 2 * 4)).toEqual(reference.slice(240 * 2 * 4, 241 * 2 * 4));
    expect([...incoming].filter((_, i) => i % 4 === 3).every(alpha => alpha === 255)).toBe(true);
  });

  it("retains adjacent border pixels even when a perfect color match lies on an overlap edge", () => {
    const destination = new Uint8ClampedArray(8 * 4), incoming = new Uint8ClampedArray(4 * 4);
    for (let x = 0; x < 8; x++) destination.set([90, 90, 90, 255], x * 4);
    for (let x = 0; x < 4; x++) incoming.set(x === 0 ? [90, 90, 90, 255] : [180, 180, 180, 255], x * 4);
    joinSceneryPixels(destination, 8, incoming, 4, 1, 4, 4);
    expect([...destination.slice(4 * 4, 5 * 4)]).toEqual([90, 90, 90, 255]);
    expect([...destination.slice(7 * 4, 8 * 4)]).toEqual([180, 180, 180, 255]);
  });

  it("removes detached generated sky speckles while preserving diagonal tree branches and the road", () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    const set = (x: number, y: number) => { pixels.set([255, 255, 255, 255], (y * 8 + x) * 4); };
    for (let x = 0; x < 8; x++) set(x, 7);
    set(2, 6); set(3, 5); set(4, 4); set(0, 0); set(1, 0);
    retainGroundConnectedAlpha(pixels, 8, 8);
    expect(pixels[3]).toBe(0); expect(pixels[7]).toBe(0);
    expect(pixels[(4 * 8 + 4) * 4 + 3]).toBe(255);
    expect(pixels[(7 * 8 + 7) * 4 + 3]).toBe(255);
  });
  it("keeps a single farm landmark, pixel direction and hard alpha across the extended meadow", () => {
    vi.stubGlobal("document", { createElement: () => new PixelCanvas() });
    const source = new PixelCanvas();
    source.width = WORLD.width; source.height = WORLD.height;
    source.pixels = new Uint8ClampedArray(source.width * source.height * 4);
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const farm = x >= 360 && x < 400 && y >= 130 && y < 170;
      source.pixels.set(farm ? [250, 250, 250, 255] : [x & 255, x >>> 8, y & 255, y < 100 ? 0 : 255], (y * source.width + x) * 4);
    }
    const result = createSceneryRepeat(source as unknown as CanvasImageSource, "near") as unknown as PixelCanvas;
    expect([result.width, result.height]).toEqual([960, 270]);
    let landmarkPixels = 0, softAlpha = 0, reversedSteps = 0;
    for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
      const offset = (y * result.width + x) * 4;
      if (result.pixels[offset + 3] !== 0 && result.pixels[offset + 3] !== 255) softAlpha++;
      if (result.pixels[offset + 1] === 250) { landmarkPixels++; continue; }
      const sourceX = result.pixels[offset]! + result.pixels[offset + 1]! * 256;
      if (x > 0) {
        const previous = offset - 4;
        if (result.pixels[previous + 1] !== 250) {
          const previousX = result.pixels[previous]! + result.pixels[previous + 1]! * 256;
          if (sourceX - previousX === -1) reversedSteps++;
        }
      }
    }
    expect(landmarkPixels).toBe(40 * 40);
    expect(softAlpha).toBe(0);
    expect(reversedSteps).toBe(0);
    // The last-to-first join follows adjacent source pixels, not a reflected edge.
    const last = (200 * result.width + result.width - 1) * 4;
    const first = 200 * result.width * 4;
    expect(result.pixels[first]! - result.pixels[last]!).toBe(1);
  });

  it("joins through matching opaque pixels without blending colors", () => {
    const width = 8, height = 4, overlap = 4;
    const destination = new Uint8ClampedArray(width * height * 4);
    const incoming = new Uint8ClampedArray(6 * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) destination.set([255, 0, 0, 255], (y * width + x) * 4);
      for (let x = 0; x < 6; x++) incoming.set(x === 2 ? [255, 0, 0, 255] : [0, 255, 0, 255], (y * 6 + x) * 4);
    }
    joinSceneryPixels(destination, width, incoming, 6, height, 2, overlap);
    for (let y = 0; y < height; y++) {
      expect([...destination.subarray((y * width + 3) * 4, (y * width + 4) * 4)]).toEqual([255, 0, 0, 255]);
      expect([...destination.subarray((y * width + 6) * 4, (y * width + 7) * 4)]).toEqual([0, 255, 0, 255]);
    }
    expect([...destination].every(value => value === 0 || value === 255)).toBe(true);
  });
});
