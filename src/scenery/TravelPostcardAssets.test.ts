import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../ambient/animalAssets', () => ({ ANIMAL_TEXTURE: 'ambient-life-atlas' }));
import { SCENERY_CARDS } from './sceneryCatalog';
import { SCENERY_ASSETS, validateSceneryTextures } from './sceneryAssets';
import { SceneryStore } from './SceneryStore';
import { TRAVEL_POSTCARD_IDS } from './TravelPostcardObserver';

interface PackedPostcard {
  name: string; tool: string; source: string; runtime: string; prompt: string;
  sourceSha256: string; runtimeSha256: string; promptSha256: string;
  runtimeSize: number[]; resampling: string; crop: null; recolor: null; transparent_background: boolean;
}
const manifest = JSON.parse(readFileSync(new URL('../../assets/travel-postcards-v2/manifest.json', import.meta.url), 'utf8')) as { assets: PackedPostcard[] };
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');

describe('additional travel postcard resources and persistence', () => {
  it('appends six distinct cards and preserves the three existing card IDs and art keys', () => {
    expect(SCENERY_CARDS.slice(0, 3).map(c => [c.id, c.art])).toEqual([
      ['rainbow-v1', 'scenery-rainbow'], ['meteors-v1', 'scenery-meteors'], ['fireflies-v1', 'scenery-fireflies'],
    ]);
    expect(SCENERY_CARDS).toHaveLength(9);
    expect(new Set(SCENERY_CARDS.map(c => c.id)).size).toBe(9);
    expect(TRAVEL_POSTCARD_IDS).toEqual(SCENERY_CARDS.slice(3).map(c => c.id));
    expect(SCENERY_ASSETS.map(a => a.key)).toEqual(SCENERY_CARDS.map(c => c.art));
    expect(SCENERY_ASSETS.every(a => a.url && a.url.includes('/runtime/') && !a.url.includes('/sources/'))).toBe(true);
  });
  it.each(TRAVEL_POSTCARD_IDS)('saves %s without clearing old and unknown postcards, and does not unlock any other new card', id => {
    let raw = JSON.stringify({ version: 1, seenIds: ['rainbow-v1', 'future-card'] });
    const setItem = (_key: string, value: string) => { raw = value; };
    const store = new SceneryStore(() => ({ getItem: () => raw, setItem }));
    expect(store.discover(id)).toEqual({ added: true, saved: true });
    expect(new SceneryStore(() => ({ getItem: () => raw, setItem })).load().seenIds).toEqual(['rainbow-v1', 'future-card', id]);
    expect(store.discover(id)).toEqual({ added: false, saved: true });
  });
  it.each(SCENERY_ASSETS.map(a => a.key))('reports absent and corrupt dimensions for %s so preload takes the retry path', key => {
    const scene = (absent = false, corrupt = false) => ({ textures: {
      exists: (candidate: string) => !absent || candidate !== key,
      get: (candidate: string) => ({ getSourceImage: () => ({ width: corrupt && candidate === key ? 1 : 600, height: 400 }) }),
    } });
    expect(validateSceneryTextures(scene(true))).toEqual([key]);
    expect(validateSceneryTextures(scene(false, true))).toEqual([key]);
    expect(validateSceneryTextures(scene())).toEqual([]);
  });
  it.each(manifest.assets)('retains builtin-generated source, prompt and proportional runtime for $name', record => {
    const root = new URL('../../assets/travel-postcards-v2/', import.meta.url);
    const source = readFileSync(new URL(record.source, root));
    const runtime = readFileSync(new URL(record.runtime, root));
    const prompt = readFileSync(new URL(record.prompt, root));
    expect(record.tool).toBe('builtin image_gen');
    expect(sha(source)).toBe(record.sourceSha256); expect(sha(runtime)).toBe(record.runtimeSha256);
    expect(sha(prompt)).toBe(record.promptSha256); expect(prompt.length).toBeGreaterThan(500);
    expect([runtime.readUInt32BE(16), runtime.readUInt32BE(20)]).toEqual([600, 400]);
    expect(record.runtimeSize).toEqual([600, 400]); expect(record.resampling).toBe('NEAREST');
    expect(record.crop).toBeNull(); expect(record.recolor).toBeNull();
    expect(record.transparent_background).toBe(false);
  });
});
