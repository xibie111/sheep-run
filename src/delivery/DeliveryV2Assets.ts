import type Phaser from 'phaser';
import duskUrl from '../../assets/delivery-menu-style-v2/runtime/dinner-dusk-pasture.png?url';
import fieldUrl from '../../assets/delivery-menu-style-v2/runtime/dinner-field.png?url';
import cottageUrl from '../../assets/delivery-menu-style-v2/runtime/dinner-cottage.png?url';
import endingUrl from '../../assets/delivery-menu-style-v2/runtime/dinner-ending.png?url';
import postcardUrl from '../../assets/delivery-menu-style-v2/runtime/dinner-postcard.png?url';
import lunchboxUrl from '../../assets/content-update-v2/delivery/runtime/lunchbox.png?url';

export const DELIVERY_V2_ASSETS = [
  { key: 'content-v2-delivery-dusk-pasture', url: duskUrl }, { key: 'content-v2-delivery-field', url: fieldUrl },
  { key: 'content-v2-delivery-cottage', url: cottageUrl }, { key: 'content-v2-delivery-dinner-ending', url: endingUrl },
  { key: 'content-v2-delivery-dinner-postcard', url: postcardUrl }, { key: 'content-v2-delivery-lunchbox', url: lunchboxUrl },
] as const;
export function validateDeliveryV2Textures(scene: Phaser.Scene): string[] {
  return DELIVERY_V2_ASSETS.filter(asset => !scene.textures.exists(asset.key)).map(asset => asset.key);
}
export function prepareDeliveryV2Textures(scene: Phaser.Scene): void {
  const missing = validateDeliveryV2Textures(scene);
  if (missing.length) throw new Error(`Delivery v2 textures missing: ${missing.join(', ')}`);
  // Phaser.Textures.FilterMode.NEAREST is 1; 0 selects LINEAR.
  DELIVERY_V2_ASSETS.forEach(asset => scene.textures.get(asset.key).setFilter(1));
}
