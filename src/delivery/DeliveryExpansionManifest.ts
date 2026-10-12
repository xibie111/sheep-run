import type Phaser from 'phaser';
import { DELIVERY_EXPANSION_ASSETS, prepareDeliveryExpansionTextures as prepareChapterArt, validateDeliveryExpansionTextures as validateChapterArt } from './DeliveryExpansionAssets';
import { DELIVERY_EXPANSION_UI_ASSETS } from './DeliveryExpansionUiAssets';

/** The composition references and original generated atlases are not runtime assets. */
export const DELIVERY_EXPANSION_RUNTIME_ASSETS = [...DELIVERY_EXPANSION_ASSETS, ...DELIVERY_EXPANSION_UI_ASSETS] as const;
export function validateDeliveryExpansionRuntime(scene: Phaser.Scene): string[] {
  const uiErrors = DELIVERY_EXPANSION_UI_ASSETS.filter(asset => {
    if (!scene.textures.exists(asset.key)) return true;
    const image = scene.textures.get(asset.key).getSourceImage() as HTMLImageElement;
    return image.width !== asset.width || image.height !== asset.height;
  }).map(asset => asset.key);
  return [...validateChapterArt(scene), ...uiErrors];
}
export function prepareDeliveryExpansionRuntime(scene: Phaser.Scene): void {
  const invalid = validateDeliveryExpansionRuntime(scene);
  if (invalid.length) throw new Error(`Delivery expansion assets invalid: ${invalid.join(', ')}`);
  prepareChapterArt(scene);
  DELIVERY_EXPANSION_UI_ASSETS.forEach(asset => scene.textures.get(asset.key).setFilter(1));
}
