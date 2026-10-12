import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "./journeyBook";
import { ACHIEVEMENT_ICON_ASSETS, achievementIconKey, createAchievementIconAssets } from "./achievementIconAssets";

function alphaSamples(png: Buffer, width: number, height: number): number[] {
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks)), stride = width * 4, alpha: number[] = [];
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
    for (let x = 3; x < stride; x += 4) alpha.push(row[x]);
    previous = row;
  }
  return alpha;
}

describe("local generated achievement icons", () => {
  it("maps every current journal ID to exactly one distinct preloaded local image", () => {
    expect(ACHIEVEMENT_ICON_ASSETS.map(asset => asset.id)).toEqual(ACHIEVEMENTS.map(achievement => achievement.id));
    expect(new Set(ACHIEVEMENT_ICON_ASSETS.map(asset => asset.key)).size).toBe(ACHIEVEMENTS.length);
    for (const asset of ACHIEVEMENT_ICON_ASSETS) {
      expect(asset.key).toBe(achievementIconKey(asset.id));
      expect(asset.url).toEqual(expect.any(String));expect(asset.url.length).toBeGreaterThan(0);
    }
  });

  it("rejects missing directories, missing catalog images and empty URLs instead of silently returning undefined", () => {
    expect(() => createAchievementIconAssets({})).toThrow(`Missing local achievement icon: ${ACHIEVEMENTS[0].id}`);
    const urls = Object.fromEntries(ACHIEVEMENTS.map(a => [`../../assets/achievement-icons-v1/runtime/${a.id}.png`, `/local/${a.id}.png`]));
    const last = ACHIEVEMENTS[ACHIEVEMENTS.length - 1], path = `../../assets/achievement-icons-v1/runtime/${last.id}.png`;
    delete urls[path];expect(() => createAchievementIconAssets(urls)).toThrow(`Missing local achievement icon: ${last.id}`);
    urls[path] = " ";expect(() => createAchievementIconAssets(urls)).toThrow(`Missing local achievement icon: ${last.id}`);
  });

  it.each(ACHIEVEMENTS)("ships a real 32 by 32 RGBA pixel PNG with transparent surroundings for $id", achievement => {
    const png = readFileSync(new URL(`../../assets/achievement-icons-v1/runtime/${achievement.id}.png`, import.meta.url));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(32);expect(png.readUInt32BE(20)).toBe(32);
    expect(png[24]).toBe(8);expect(png[25]).toBe(6);expect(png[28]).toBe(0);
    const alpha = alphaSamples(png, 32, 32);
    expect(alpha.some(value => value === 0)).toBe(true);expect(alpha.some(value => value > 0)).toBe(true);
  });
});
