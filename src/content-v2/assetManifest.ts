import type Phaser from 'phaser';

export const CONTENT_V2_KEYS = {
  tripPaper: 'content-v2-trip-paper', tripEntry: 'content-v2-trip-entry', close: 'content-v2-close',
  chapterCard: 'content-v2-chapter-card', stampRecord: 'content-v2-stamp-record',
  stampCollection: 'content-v2-stamp-collection', stampGoal: 'content-v2-stamp-goal',
  stampCompanion: 'content-v2-stamp-companion', stampAnimal: 'content-v2-stamp-animal',
  stampLandmark: 'content-v2-stamp-landmark',
} as const;

const dimensions: Record<keyof typeof CONTENT_V2_KEYS, readonly [number, number]> = {
  tripPaper: [1280, 657], tripEntry: [480, 154], close: [480, 116], chapterCard: [480, 314],
  stampRecord: [160, 152], stampCollection: [160, 152], stampGoal: [160, 152],
  stampCompanion: [160, 152], stampAnimal: [160, 152], stampLandmark: [160, 154],
};

/** Project-local image_gen output; composition references are never preloaded. */
export const CONTENT_V2_UI_ASSETS = Object.entries(CONTENT_V2_KEYS).map(([name, key]) => ({
  key, url: new URL(`../../assets/content-update-v2/ui/runtime/${name}.png`, import.meta.url).href,
  width: dimensions[name as keyof typeof dimensions][0], height: dimensions[name as keyof typeof dimensions][1],
}));

export function validateContentUiTextures(scene: Phaser.Scene): string[] {
  return CONTENT_V2_UI_ASSETS.filter(asset => {
    if (!scene.textures.exists(asset.key)) return true;
    const source = scene.textures.get(asset.key).getSourceImage() as HTMLImageElement;
    return source.width !== asset.width || source.height !== asset.height;
  }).map(asset => asset.key);
}

export function prepareContentUiTextures(scene: Phaser.Scene): void {
  const missing = validateContentUiTextures(scene);
  if (missing.length) throw new Error(`Content v2 UI textures missing: ${missing.join(', ')}`);
  // Phaser.Textures.FilterMode: LINEAR=0, NEAREST=1 (also on WebGL sources).
  CONTENT_V2_UI_ASSETS.forEach(asset => scene.textures.get(asset.key).setFilter(1));
}
