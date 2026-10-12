import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CONTENT_V2_KEYS, CONTENT_V2_UI_ASSETS, prepareContentUiTextures, validateContentUiTextures } from './assetManifest';

const fixture = (missing: readonly string[] = [], corrupt = '') => {
  const setFilter = vi.fn();
  const scene = { textures: { exists: (key: string) => !missing.includes(key), get: (key: string) => {
    const expected = CONTENT_V2_UI_ASSETS.find(asset => asset.key === key)!;
    return { getSourceImage: () => ({width: key === corrupt ? 1 : expected.width, height: expected.height}), setFilter };
  } } } as unknown as Phaser.Scene;
  return {scene, setFilter};
};
describe('content v2 preload contract', () => {
  it('loads only distinct project-local runtime components, never generated preview pages', () => {
    expect(new Set(CONTENT_V2_UI_ASSETS.map(asset => asset.key)).size).toBe(10);
    for (const asset of CONTENT_V2_UI_ASSETS) {
      expect(asset.url).toContain('/assets/content-update-v2/ui/runtime/');
      expect(asset.url).not.toMatch(/sources|reference|generated_images/);
    }
  });
  it('reports missing/corrupt textures before UI construction; successful retry may prepare repeatedly', () => {
    const failed = fixture([CONTENT_V2_KEYS.tripPaper], CONTENT_V2_KEYS.stampGoal);
    expect(validateContentUiTextures(failed.scene)).toEqual([CONTENT_V2_KEYS.tripPaper, CONTENT_V2_KEYS.stampGoal]);
    expect(() => prepareContentUiTextures(failed.scene)).toThrow('content-v2-trip-paper');
    expect(failed.setFilter).not.toHaveBeenCalled();
    const loaded = fixture(); expect(validateContentUiTextures(loaded.scene)).toEqual([]);
    prepareContentUiTextures(loaded.scene); prepareContentUiTextures(loaded.scene);
    expect(loaded.setFilter).toHaveBeenCalledTimes(20);
    expect(loaded.setFilter).toHaveBeenCalledWith(1);
  });
});
