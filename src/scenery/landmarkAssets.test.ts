import { describe, expect, it, vi } from 'vitest';
import { LANDMARK_ASSETS, prepareLandmarkTextures, validateLandmarkTextures } from './landmarkAssets';
import { LANDMARKS } from './landmarkCatalog';

describe('landmark runtime asset contract', () => {
  it('exports complete local PNG keys and validates exact generated silhouette dimensions', () => {
    const filter = vi.fn(), textures = { exists: () => true, get: (key: string) => {
      const item = LANDMARKS.find(definition => definition.key === key)!;
      return { get: () => ({ cutWidth: item.width * 2, cutHeight: item.height * 2 }), setFilter: filter };
    } };
    expect(LANDMARK_ASSETS.map(item => item.key)).toEqual(LANDMARKS.map(item => item.key));
    expect(LANDMARK_ASSETS.every(item => item.url.includes('/assets/content-update-v2/landmarks/runtime/'))).toBe(true);
    expect(validateLandmarkTextures({ textures } as never)).toEqual([]);
    prepareLandmarkTextures({ textures } as never); expect(filter).toHaveBeenCalledTimes(3);
    expect(filter.mock.calls.every(call => call[0] === 1)).toBe(true);
  });
  it('rejects absent or wrong-size textures so preload retries cannot silently use a placeholder', () => {
    const absent = { textures: { exists: () => false } };
    expect(validateLandmarkTextures(absent as never)).toHaveLength(3);
    expect(() => prepareLandmarkTextures(absent as never)).toThrow('Missing content-v2 landmark textures');
    const malformed = { textures: { exists: () => true, get: () => ({ get: () => ({ cutWidth: 1, cutHeight: 1 }) }) } };
    expect(validateLandmarkTextures(malformed as never)).toHaveLength(3);
  });
});
