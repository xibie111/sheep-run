import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { COMPANION_RESPONSE_KEYS } from '../companions/CompanionResponses';
import { createRunnerV2Assets, RUNNER_V2_ASSETS, RUNNER_V2_ASSET_IDS, runnerV2AssetKey } from './runnerAssets';

function rgbaPng(png: Buffer) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  expect(png[24]).toBe(8); expect(png[25]).toBe(6); expect(png[28]).toBe(0);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks)), stride = width * 4, rgba = Buffer.alloc(width * height * 4);
  expect(inflated.length).toBe(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)]; expect(filter).toBeLessThanOrEqual(4);
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    row.set(inflated.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? row[x - 4] : 0, above = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const corner = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4] : 0;
      const p = left + above - corner, dl = Math.abs(p - left), da = Math.abs(p - above), dc = Math.abs(p - corner);
      const prediction = filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) :
        filter === 4 ? (dl <= da && dl <= dc ? left : da <= dc ? above : corner) : 0;
      row[x] = (row[x] + prediction) & 255;
    }
  }
  return { width, height, rgba };
}
function nearestIndices(sourceSize: number, targetSize: number): number[] {
  // Pillow's nearest transform advances a double-precision sample coordinate.
  // Advance in the same order, including exact-boundary floating-point rounding.
  const scale = sourceSize / targetSize, samples: number[] = [];
  let coordinate = scale / 2;
  for (let i = 0; i < targetSize; i++, coordinate += scale) samples.push(Math.min(sourceSize - 1, Math.floor(coordinate)));
  return samples;
}
interface Entry {
  id: string; source: string; sourceSha256: string; runtime: string; runtimeSha256: string;
  crop: [number, number, number, number]; contentSize: [number, number]; position: [number, number]; runtimeSize: [number, number];
}
const assetRoot = '../../assets/runner-update-v2/';
const processing = JSON.parse(readFileSync(new URL(`${assetRoot}processing.json`, import.meta.url), 'utf8')) as { entries: Entry[]; resampling: string };
const bytes = (path: string) => readFileSync(new URL(`${assetRoot}${path}`, import.meta.url));
const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

describe('locally packaged built-in runner artwork', () => {
  it('maps the five unique local textures including the actual companion response keys', () => {
    expect(RUNNER_V2_ASSETS.map(asset => asset.id)).toEqual([...RUNNER_V2_ASSET_IDS]);
    expect(RUNNER_V2_ASSETS.map(asset => asset.key)).toEqual([
      'runner-v2-goal-panel', 'runner-v2-goal-stamp', COMPANION_RESPONSE_KEYS.star, COMPANION_RESPONSE_KEYS.crown, COMPANION_RESPONSE_KEYS.heart,
    ]);
    expect(new Set(RUNNER_V2_ASSETS.map(asset => asset.key)).size).toBe(5);
    for (const asset of RUNNER_V2_ASSETS) {
      expect(asset.key).toBe(runnerV2AssetKey(asset.id)); expect(asset.url.trim().length).toBeGreaterThan(0);
    }
  });
  it('fails loudly on an incomplete local art bundle and empty asset URLs', () => {
    expect(() => createRunnerV2Assets({})).toThrow('Missing local runner v2 image: goal-panel');
    const urls = Object.fromEntries(RUNNER_V2_ASSET_IDS.map(id => [`${assetRoot}runtime/${id}.png`, `/local/${id}.png`]));
    delete urls[`${assetRoot}runtime/response-heart.png`];
    expect(() => createRunnerV2Assets(urls)).toThrow('Missing local runner v2 image: response-heart');
    urls[`${assetRoot}runtime/response-heart.png`] = ' ';
    expect(() => createRunnerV2Assets(urls)).toThrow('Missing local runner v2 image: response-heart');
  });
  it('retains complete processing provenance for each generated original', () => {
    expect(processing.resampling).toBe('NEAREST');
    expect(processing.entries.map(entry => entry.id)).toEqual([...RUNNER_V2_ASSET_IDS]);
    for (const entry of processing.entries) {
      expect(sha256(bytes(entry.source))).toBe(entry.sourceSha256);
      expect(sha256(bytes(entry.runtime))).toBe(entry.runtimeSha256);
    }
  });
  it.each(RUNNER_V2_ASSET_IDS)('ships visible RGBA art with genuine transparent surroundings: %s', id => {
    const image = rgbaPng(bytes(`runtime/${id}.png`));
    expect([image.width, image.height]).toEqual(id === 'goal-panel' ? [232, 34] : [32, 32]);
    const alpha = [...image.rgba].filter((_, index) => index % 4 === 3);
    expect(alpha.some(value => value === 0)).toBe(true); expect(alpha.some(value => value >= 128)).toBe(true);
    if (id !== 'goal-panel') for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (x < 2 || x >= 30 || y < 2 || y >= 30) expect(image.rgba[(y * image.width + x) * 4 + 3]).toBe(0);
    }
    if (id === 'response-crown' || id === 'response-heart') expect(Math.max(...alpha)).toBe(254);
  });
  it.each(RUNNER_V2_ASSET_IDS)('preserves source RGBA pixels using nearest sampling and centered proportional framing: %s', id => {
    const entry = processing.entries.find(item => item.id === id)!;
    const original = rgbaPng(bytes(entry.source)), runtime = rgbaPng(bytes(entry.runtime));
    const [left, top, right, bottom] = entry.crop, [width, height] = entry.contentSize;
    const [offsetX, offsetY] = entry.position;
    const samplesX = nearestIndices(right - left, width), samplesY = nearestIndices(bottom - top, height);
    expect(width / height).toBeCloseTo((right - left) / (bottom - top), 0);
    if (id !== 'goal-panel') { expect(Math.max(width, height)).toBe(28); expect(offsetX).toBe(Math.floor((32 - width) / 2)); expect(offsetY).toBe(Math.floor((32 - height) / 2)); }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sourceX = left + samplesX[x], sourceY = top + samplesY[y];
      const sourceOffset = (sourceY * original.width + sourceX) * 4;
      const runtimeOffset = ((y + offsetY) * runtime.width + x + offsetX) * 4;
      expect([...runtime.rgba.subarray(runtimeOffset, runtimeOffset + 4)]).toEqual([...original.rgba.subarray(sourceOffset, sourceOffset + 4)]);
    }
  });
});
