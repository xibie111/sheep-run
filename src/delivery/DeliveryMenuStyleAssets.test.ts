import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DELIVERY_EXPANSION_ASSETS } from './DeliveryExpansionAssets';
import { DELIVERY_V2_ASSETS } from './DeliveryV2Assets';

const base = 'assets/delivery-menu-style-v2/';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const file = (path: string) => readFileSync(new URL('../../' + path, import.meta.url));
const manifest = JSON.parse(file(base + 'processing.json').toString()) as {
  complete: boolean; partial: boolean; sourceCount: number; runtimeCount: number;
  runtimeDependsOnExternalPaths: boolean;
  records: Array<{
    name: string; key: string; kind: string; source: string; sourceSha256: string;
    runtime: string; runtimeSha256: string; runtimeByteCount: number; size: [number, number];
    width: number; height: number; mode: string; sampler: string; authoredArt: boolean; padding: boolean;
    originalSize: [number, number]; resizedSize: [number, number]; crop: [number, number, number, number];
    sourceRoadRow: number | null; runtimeRoadRow: number | null; uniformScale: number;
    uniformScaleApplied: boolean;
    generation: {
      rawGeneratedPaths: string[];
      promptFiles: Array<{ path: string; sha256: string }>;
      metadata: Array<{ path: string; sha256: string; details: Record<string, unknown> }>;
      referenceFiles: Array<{ path: string; sha256: string }>;
    };
  }>;
};
const expectedNames = [
  ...['windmill', 'rain', 'lighthouse'].flatMap(theme =>
    ['pasture', 'middle', 'destination', 'ending', 'postcard'].map(stage => theme + '-' + stage)),
  'dinner-dusk-pasture', 'dinner-field', 'dinner-cottage', 'dinner-ending', 'dinner-postcard',
];
const allAssets = [...DELIVERY_EXPANSION_ASSETS, ...DELIVERY_V2_ASSETS];

/** RGB PNGs without a color-key transparency chunk are opaque at every pixel. */
function inspectPng(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const chunks: string[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    expect(offset + length + 12).toBeLessThanOrEqual(bytes.length);
    chunks.push(bytes.subarray(offset + 4, offset + 8).toString());
    offset += length + 12;
  }
  return {
    size: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    colorType: bytes[25], chunks,
  };
}

describe('menu-style delivery runtime art', () => {
  it('ships exactly 20 opaque PNGs at their actual background and postcard dimensions', () => {
    expect(manifest.complete).toBe(true); expect(manifest.partial).toBe(false);
    expect(manifest.sourceCount).toBe(16); expect(manifest.runtimeCount).toBe(20);
    expect(manifest.records.map(row => row.name)).toEqual(expectedNames);
    expect(readdirSync(new URL('../../' + base + 'runtime/', import.meta.url)).filter(name => name.endsWith('.png')).sort())
      .toEqual(expectedNames.map(name => name + '.png').sort());
    for (const row of manifest.records) {
      expect(row.runtime).toBe(base + 'runtime/' + row.name + '.png');
      const bytes = file(row.runtime), png = inspectPng(bytes);
      const expected = row.name.endsWith('-postcard') ? [640, 360] : [960, 540];
      expect(png.size, row.name).toEqual(expected);
      expect([row.width, row.height], row.name).toEqual(expected);
      expect(row.size, row.name).toEqual(expected);
      expect(png.colorType, row.name).toBe(2);
      expect(png.chunks, row.name).not.toContain('tRNS');
      expect(row.mode, row.name).toBe('RGB');
      expect(bytes.length, row.name).toBe(row.runtimeByteCount);
      expect(hash(bytes), row.name).toBe(row.runtimeSha256);
    }
  });

  it('maps every existing texture key to the new runtime file without duplicating keys', () => {
    expect(new Set(manifest.records.map(row => row.key)).size).toBe(20);
    for (const row of manifest.records) {
      const asset = allAssets.find(item => item.key === row.key);
      expect(asset, row.key).toBeDefined();
      const url = new URL(asset!.url, 'http://delivery-art.test/');
      const path = decodeURIComponent(url.pathname).replaceAll('\\', '/');
      expect(path.endsWith('/' + row.runtime), row.key + ': ' + asset!.url).toBe(true);
    }
  });

  it('retains the selected generated originals and complete prompt/provenance records', () => {
    expect(manifest.runtimeDependsOnExternalPaths).toBe(false);
    const selectedSources = new Set(manifest.records.map(row => row.source));
    expect(selectedSources.size).toBe(16);
    for (const row of manifest.records) {
      expect(row.source).toMatch(/^assets\/delivery-menu-style-v2\/sources\/[^/]+\.png$/);
      expect(row.source).not.toMatch(/attempt|initial/);
      expect(hash(file(row.source)), row.name).toBe(row.sourceSha256);
      expect(inspectPng(file(row.source)).size, row.name).toEqual(row.originalSize);
      expect(row.generation.rawGeneratedPaths.length, row.name).toBeGreaterThan(0);
      expect(row.generation.promptFiles.length, row.name).toBeGreaterThan(0);
      expect(row.generation.metadata.length, row.name).toBeGreaterThan(0);
      for (const prompt of row.generation.promptFiles) expect(hash(file(prompt.path))).toBe(prompt.sha256);
      for (const metadata of row.generation.metadata) {
        expect(hash(file(metadata.path))).toBe(metadata.sha256);
        expect(metadata.details).toBeTypeOf('object');
      }
      expect(row.generation.referenceFiles.length, row.name).toBeGreaterThan(0);
      for (const reference of row.generation.referenceFiles)
        expect(hash(readFileSync(reference.path))).toBe(reference.sha256);
    }
  });

  it('uses uniform nearest scaling and an in-bounds crop with no padded or drawn pixels', () => {
    for (const row of manifest.records) {
      expect(row.sampler).toBe('NEAREST'); expect(row.uniformScaleApplied).toBe(true);
      expect(row.padding).toBe(false); expect(row.authoredArt).toBe(false);
      expect(row.uniformScale).toBeGreaterThan(0);
      const [x0, y0, x1, y1] = row.crop;
      expect(x0).toBeGreaterThanOrEqual(0); expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(row.resizedSize[0]); expect(y1).toBeLessThanOrEqual(row.resizedSize[1]);
      expect([x1 - x0, y1 - y0]).toEqual(row.size);
      for (const axis of [0, 1] as const)
        expect(Math.abs(row.resizedSize[axis] - row.originalSize[axis] * row.uniformScale)).toBeLessThan(1);
      if (row.kind === 'landscape') {
        expect(row.sourceRoadRow).toBeGreaterThan(0);
        expect(row.runtimeRoadRow).toBe(389);
        expect(Math.abs(row.sourceRoadRow! * row.uniformScale - y0 - 389)).toBeLessThanOrEqual(.5);
      } else {
        expect(row.sourceRoadRow).toBeNull(); expect(row.runtimeRoadRow).toBeNull();
      }
    }
  });

  it('derives each smaller postcard from its corresponding ending original', () => {
    for (const theme of ['windmill', 'rain', 'lighthouse', 'dinner']) {
      const ending = manifest.records.find(row => row.name === theme + '-ending')!;
      const postcard = manifest.records.find(row => row.name === theme + '-postcard')!;
      expect(postcard.source).toBe(ending.source); expect(postcard.sourceSha256).toBe(ending.sourceSha256);
      expect(postcard.originalSize).toEqual(ending.originalSize); expect(postcard.kind).toBe('postcard');
      expect(postcard.runtimeSha256).not.toBe(ending.runtimeSha256);
    }
  });

  it('preserves all 114 old asset files and 9 protected gameplay/save/input files', () => {
    const baseline = JSON.parse(file('docs/delivery-menu-style-v2/baseline.json').toString()) as {
      files: Record<string, string>; protectedCode: Record<string, string>;
    };
    expect(Object.keys(baseline.files)).toHaveLength(114);
    expect(Object.keys(baseline.protectedCode)).toHaveLength(9);
    for (const group of [baseline.files, baseline.protectedCode])
      for (const [path, expected] of Object.entries(group)) expect(hash(file(path)), path).toBe(expected);
  });
});
