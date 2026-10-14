import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SKIN_ANIMATION_FRAMES } from "./skinSpriteAssets";

const IDS = ["bee-v1", "mushroom-v1", "chef-v1", "pirate-v1", "fox-v1", "dinosaur-v1"] as const;
const POSES = ["idle_1", "run_1", "run_2", "run_3", "run_4", "jump", "fall", "hit", "dash_1", "dead", "idle_2", "run_5", "run_6", "dash_2", "dead_settled"];
const ROOT = new URL("../../", import.meta.url);
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
interface FrameEntry { index: number; pose: string; bbox: number[]; footBaseline: number; rgbaHash: string; silhouetteHash: string; uniformScale: number }
interface SkinEntry { id: string; source: string; sourceHash: string; runtime: string; runtimeHash: string; frameCount: number; scale: number; frames: FrameEntry[]; generatedBy?: string }
const manifest = JSON.parse(readFileSync(new URL("assets/skins/runtime-v5/manifest.json", ROOT), "utf8")) as { generatedBy: string; frameNames: string[]; protectedOldAssetHashes: Record<string, string>; skins: SkinEntry[] };

/** Decode real runtime ink; metadata alone cannot prove a complete animation. */
function rgba(png: Buffer, width: number, height: number): Buffer {
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks)), stride = width * 4, pixels = Buffer.alloc(width * height * 4);
  expect(inflated.length).toBe(height * (stride + 1));
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)], row = Buffer.from(inflated.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? row[x - 4] : 0, above = previous[x], corner = x >= 4 ? previous[x - 4] : 0;
      const p = left + above - corner, dl = Math.abs(p - left), da = Math.abs(p - above), dc = Math.abs(p - corner);
      const prediction = filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) :
        filter === 4 ? (dl <= da && dl <= dc ? left : da <= dc ? above : corner) : 0;
      row[x] = (row[x] + prediction) & 255;
    }
    row.copy(pixels, y * stride); previous = row;
  }
  return pixels;
}

describe("six generated v5 asset contracts", () => {
  it("keeps the existing 15-pose order and references built-in image generation", () => {
    expect(manifest.generatedBy).toBe("builtin-image_gen");
    expect(manifest.frameNames).toEqual(POSES);
    expect(manifest.skins.map(skin => skin.id)).toEqual(IDS);
  });

  it.each(IDS)("%s provides real 15-pose hard-alpha art with registered feet and no copied standing placeholders", id => {
    const skin = manifest.skins.find(entry => entry.id === id)!;
    const source = readFileSync(new URL(skin.source, ROOT)), png = readFileSync(new URL(skin.runtime, ROOT));
    expect(hash(source)).toBe(skin.sourceHash); expect(hash(png)).toBe(skin.runtimeHash);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(640); expect(png.readUInt32BE(20)).toBe(384);
    expect(png[24]).toBe(8); expect(png[25]).toBe(6); expect(png[28]).toBe(0);
    expect(skin.frameCount).toBe(15); expect(skin.frames).toHaveLength(15);
    expect(skin.frames.map(frame => frame.pose)).toEqual(POSES);
    expect(new Set(skin.frames.map(frame => frame.uniformScale))).toEqual(new Set([skin.scale]));
    const sourcePixels = rgba(source, source.readUInt32BE(16), source.readUInt32BE(20)), sourceColors = new Set<number>();
    for (let offset = 0; offset < sourcePixels.length; offset += 4) {
      if (sourcePixels[offset + 3] >= 128) sourceColors.add(sourcePixels.readUIntBE(offset, 3));
    }
    const pixels = rgba(png, 640, 384), rgbaHashes: string[] = [], silhouettes: string[] = [];
    const runtimeColors = new Set<number>();
    for (let index = 0; index < 15; index++) {
      const frame = Buffer.alloc(128 * 128 * 4), alpha = Buffer.alloc(128 * 128);
      let minX = 128, minY = 128, maxX = -1, maxY = -1, count = 0, softAlpha = 0, paddingInk = 0;
      for (let y = 0; y < 128; y++) {
        const sourceStart = (((Math.floor(index / 5) * 128 + y) * 640) + index % 5 * 128) * 4;
        pixels.copy(frame, y * 128 * 4, sourceStart, sourceStart + 128 * 4);
        for (let x = 0; x < 128; x++) {
          const a = frame[(y * 128 + x) * 4 + 3]; alpha[y * 128 + x] = a;
          if (a !== 0 && a !== 255) softAlpha++;
          if (y < 16 && a) paddingInk++;
          if (a) { count++; runtimeColors.add(frame.readUIntBE((y * 128 + x) * 4, 3)); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
        }
      }
      expect(softAlpha).toBe(0); expect(paddingInk).toBe(0);
      expect(count).toBeGreaterThan(1000); expect(minX).toBeGreaterThanOrEqual(4); expect(maxX).toBeLessThan(124);
      expect(minY).toBeGreaterThanOrEqual(16); expect(maxY + 1).toBe(index === 5 ? 120 : 128);
      expect([minX, minY, maxX + 1, maxY + 1]).toEqual(skin.frames[index].bbox);
      rgbaHashes.push(hash(frame)); silhouettes.push(hash(alpha));
      expect(hash(frame)).toBe(skin.frames[index].rgbaHash); expect(hash(alpha)).toBe(skin.frames[index].silhouetteHash);
    }
    expect(new Set(rgbaHashes).size).toBe(15);
    // Hard-alpha registration may remove RGB samples but cannot invent or recolor visible RGB.
    expect([...runtimeColors].every(color => sourceColors.has(color))).toBe(true);
    expect(new Set(SKIN_ANIMATION_FRAMES.run.map(index => silhouettes[index])).size).toBe(6);
    expect(silhouettes[5]).not.toBe(silhouettes[0]);
    expect(silhouettes[7]).not.toBe(silhouettes[0]);
    expect(silhouettes[9]).not.toBe(silhouettes[0]);
  });

  it("preserves every previous source and runtime skin byte-for-byte", () => {
    expect(Object.keys(manifest.protectedOldAssetHashes).length).toBeGreaterThanOrEqual(76);
    for (const [path, expected] of Object.entries(manifest.protectedOldAssetHashes)) expect(hash(readFileSync(new URL(path, ROOT)))).toBe(expected);
  });
});
