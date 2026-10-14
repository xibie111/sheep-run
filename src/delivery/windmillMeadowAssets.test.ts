import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class Scene {} } }));
vi.mock('../ui/LoadingScreen', () => ({ showLoadingScreen: () => null, hideLoadingScreen: vi.fn() }));
vi.mock('../content-v2', () => ({
  CONTENT_V2_ASSETS: [], validateContentV2Textures: () => [], prepareContentV2Textures: vi.fn(),
}));
vi.mock('../residents/residentAssets', () => ({
  RESIDENT_ASSETS: [], validateResidentTextures: () => [], prepareResidentTextures: vi.fn(),
}));

import { PreloadScene } from '../scenes/PreloadScene';
import { DELIVERY_ASSETS } from './deliveryAssets';
import { WINDMILL_MEADOW_ART, WINDMILL_MEADOW_ASSETS } from './windmillMeadowAssets';

function loaderFixture(missing: readonly string[] = []) {
  const existing = new Set(WINDMILL_MEADOW_ASSETS.map(asset => asset.key).filter(key => !missing.includes(key)));
  const image = vi.fn(), remove = vi.fn(), restart = vi.fn();
  const exists = (key: string) => !WINDMILL_MEADOW_ASSETS.some(asset => asset.key === key) || existing.has(key as typeof WINDMILL_MEADOW_ASSETS[number]['key']);
  const scene = new PreloadScene();
  Object.assign(scene, {
    events: { once: vi.fn() },
    load: { image, spritesheet: vi.fn(), bitmapFont: vi.fn(), on: vi.fn(), off: vi.fn() },
    textures: { exists, remove, get: () => ({ getSourceImage: () => ({ width: 600, height: 400 }) }) },
    cache: { bitmapFont: { remove: vi.fn() }, xml: { remove: vi.fn() } },
    scene: { restart },
  });
  const internals = scene as unknown as { validateImages(): void; retryLocalAssets(): void };
  return { scene, image, remove, restart, internals };
}

afterEach(() => vi.unstubAllGlobals());

describe('windmill meadow local asset loading', () => {
  it('declares three separate runtime URLs and preserves the original delivery keys', () => {
    expect(WINDMILL_MEADOW_ASSETS.map(asset => asset.key)).toEqual([
      'windmill-meadow-physics-backdrop', 'windmill-meadow-physics-landmark', 'windmill-meadow-physics-grass',
    ]);
    expect(new Set(DELIVERY_ASSETS.map(asset => asset.key)).size).toBe(DELIVERY_ASSETS.length);
    expect(DELIVERY_ASSETS.slice(0, 3).map(asset => asset.key)).toEqual([
      'delivery-forest-v1', 'delivery-hill-v1', 'delivery-postcard-v1',
    ]);
    const filenames = ['backdrop', 'windmill', 'grass'];
    WINDMILL_MEADOW_ASSETS.forEach((asset, index) => {
      expect(new URL(asset.url).pathname).toContain(`/assets/windmill-physics-v1/runtime/${filenames[index]}.png`);
      expect(DELIVERY_ASSETS).toContain(asset);
    });
    expect(WINDMILL_MEADOW_ART.landmark).toBe(WINDMILL_MEADOW_ASSETS[1]);
  });

  it('queues the missing layers once through the existing Preload loader', () => {
    const fixture = loaderFixture(WINDMILL_MEADOW_ASSETS.map(asset => asset.key));
    fixture.scene.preload();
    for (const asset of WINDMILL_MEADOW_ASSETS) {
      expect(fixture.image.mock.calls.filter(([key]) => key === asset.key)).toEqual([[asset.key, asset.url]]);
    }
  });

  it('reuses loaded layers and only queues a missing grass texture', () => {
    const fixture = loaderFixture([WINDMILL_MEADOW_ART.grass.key]);
    fixture.scene.preload();
    expect(fixture.image).toHaveBeenCalledWith(WINDMILL_MEADOW_ART.grass.key, WINDMILL_MEADOW_ART.grass.url);
    expect(fixture.image.mock.calls.some(([key]) => key === WINDMILL_MEADOW_ART.backdrop.key)).toBe(false);
    expect(fixture.image.mock.calls.some(([key]) => key === WINDMILL_MEADOW_ART.landmark.key)).toBe(false);
  });

  it.each(WINDMILL_MEADOW_ASSETS)('blocks preparation if the $key required layer is missing', asset => {
    const fixture = loaderFixture([asset.key]);
    expect(() => fixture.internals.validateImages()).toThrow(asset.key);
  });

  it('clears all three layer caches on the existing retry without touching saved data', () => {
    const localStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('window', { localStorage });
    const fixture = loaderFixture();
    expect(() => fixture.internals.validateImages()).not.toThrow();
    fixture.internals.retryLocalAssets();
    for (const asset of WINDMILL_MEADOW_ASSETS) expect(fixture.remove).toHaveBeenCalledWith(asset.key);
    expect(fixture.restart).toHaveBeenCalledOnce();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
});
