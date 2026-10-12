import type Phaser from 'phaser';
import { LANDMARKS } from './landmarkCatalog';

export const LANDMARK_ASSETS = [
  { key: 'content-v2-landmark-windmill', url: new URL('../../assets/content-update-v2/landmarks/runtime/windmill.png', import.meta.url).href },
  { key: 'content-v2-landmark-barn', url: new URL('../../assets/content-update-v2/landmarks/runtime/barn.png', import.meta.url).href },
  { key: 'content-v2-landmark-bridge', url: new URL('../../assets/content-update-v2/landmarks/runtime/bridge.png', import.meta.url).href },
] as const;

/** Re-run after a preload retry; this creates no textures and is safe to repeat. */
export function prepareLandmarkTextures(scene: Pick<Phaser.Scene, 'textures'>): void {
  const missing = validateLandmarkTextures(scene);
  if (missing.length) throw new Error(`Missing content-v2 landmark textures: ${missing.join(', ')}`);
  // Phaser.Textures.FilterMode.NEAREST is 1; 0 selects LINEAR.
  for (const asset of LANDMARK_ASSETS) scene.textures.get(asset.key).setFilter(1);
}
export function validateLandmarkTextures(scene: Pick<Phaser.Scene, 'textures'>): string[] {
  return LANDMARKS.filter(item => {
    if (!scene.textures.exists(item.key)) return true;
    const frame = scene.textures.get(item.key).get('__BASE');
    return frame.cutWidth !== item.width * 2 || frame.cutHeight !== item.height * 2;
  }).map(item => item.key);
}
