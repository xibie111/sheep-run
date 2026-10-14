import type Phaser from 'phaser';
import windmillPastureUrl from '../../assets/delivery-menu-style-v2/runtime/windmill-pasture.png?url';
import windmillMiddleUrl from '../../assets/delivery-menu-style-v2/runtime/windmill-middle.png?url';
import windmillDestinationUrl from '../../assets/delivery-menu-style-v2/runtime/windmill-destination.png?url';
import windmillEndingUrl from '../../assets/delivery-menu-style-v2/runtime/windmill-ending.png?url';
import windmillPostcardUrl from '../../assets/delivery-menu-style-v2/runtime/windmill-postcard.png?url';
import windmillCarriedUrl from '../../assets/delivery-expansion-v1/chapters/runtime/windmill-carried.png?url';
import windmillOrdinaryUrl from '../../assets/delivery-expansion-v1/chapters/runtime/windmill-ordinary.png?url';
import windmillKeepsakeUrl from '../../assets/delivery-expansion-v1/chapters/runtime/windmill-keepsake.png?url';
import rainPastureUrl from '../../assets/delivery-menu-style-v2/runtime/rain-pasture.png?url';
import rainMiddleUrl from '../../assets/delivery-menu-style-v2/runtime/rain-middle.png?url';
import rainDestinationUrl from '../../assets/delivery-menu-style-v2/runtime/rain-destination.png?url';
import rainEndingUrl from '../../assets/delivery-menu-style-v2/runtime/rain-ending.png?url';
import rainPostcardUrl from '../../assets/delivery-menu-style-v2/runtime/rain-postcard.png?url';
import rainCarriedUrl from '../../assets/delivery-expansion-v1/chapters/runtime/rain-carried.png?url';
import rainOrdinaryUrl from '../../assets/delivery-expansion-v1/chapters/runtime/rain-ordinary.png?url';
import rainKeepsakeUrl from '../../assets/delivery-expansion-v1/chapters/runtime/rain-keepsake.png?url';
import lighthousePastureUrl from '../../assets/delivery-menu-style-v2/runtime/lighthouse-pasture.png?url';
import lighthouseMiddleUrl from '../../assets/delivery-menu-style-v2/runtime/lighthouse-middle.png?url';
import lighthouseDestinationUrl from '../../assets/delivery-menu-style-v2/runtime/lighthouse-destination.png?url';
import lighthouseEndingUrl from '../../assets/delivery-menu-style-v2/runtime/lighthouse-ending.png?url';
import lighthousePostcardUrl from '../../assets/delivery-menu-style-v2/runtime/lighthouse-postcard.png?url';
import lighthouseCarriedUrl from '../../assets/delivery-expansion-v1/chapters/runtime/lighthouse-carried.png?url';
import lighthouseOrdinaryUrl from '../../assets/delivery-expansion-v1/chapters/runtime/lighthouse-ordinary.png?url';
import lighthouseKeepsakeUrl from '../../assets/delivery-expansion-v1/chapters/runtime/lighthouse-keepsake.png?url';

/** Only generated chapter art; UI asset list is independent. */
export const DELIVERY_EXPANSION_ASSETS = [
  { key: 'delivery-expansion-windmill-pasture', url: windmillPastureUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-windmill-middle', url: windmillMiddleUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-windmill-destination', url: windmillDestinationUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-windmill-ending', url: windmillEndingUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-windmill-postcard', url: windmillPostcardUrl, width: 640, height: 360 },
  { key: 'delivery-expansion-windmill-carried', url: windmillCarriedUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-windmill-ordinary', url: windmillOrdinaryUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-windmill-keepsake', url: windmillKeepsakeUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-rain-pasture', url: rainPastureUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-rain-middle', url: rainMiddleUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-rain-destination', url: rainDestinationUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-rain-ending', url: rainEndingUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-rain-postcard', url: rainPostcardUrl, width: 640, height: 360 },
  { key: 'delivery-expansion-rain-carried', url: rainCarriedUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-rain-ordinary', url: rainOrdinaryUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-rain-keepsake', url: rainKeepsakeUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-lighthouse-pasture', url: lighthousePastureUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-lighthouse-middle', url: lighthouseMiddleUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-lighthouse-destination', url: lighthouseDestinationUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-lighthouse-ending', url: lighthouseEndingUrl, width: 960, height: 540 },
  { key: 'delivery-expansion-lighthouse-postcard', url: lighthousePostcardUrl, width: 640, height: 360 },
  { key: 'delivery-expansion-lighthouse-carried', url: lighthouseCarriedUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-lighthouse-ordinary', url: lighthouseOrdinaryUrl, width: 80, height: 80 },
  { key: 'delivery-expansion-lighthouse-keepsake', url: lighthouseKeepsakeUrl, width: 80, height: 80 },
] as const;

/** Wrong dimensions are retryable invalid assets, as are missing textures. */
export function validateDeliveryExpansionTextures(scene: Phaser.Scene): string[] {
  return DELIVERY_EXPANSION_ASSETS.filter(asset => {
    if (!scene.textures.exists(asset.key)) return true;
    const source = scene.textures.get(asset.key).getSourceImage() as { width: number; height: number };
    return source.width !== asset.width || source.height !== asset.height;
  }).map(asset => asset.key);
}
export function prepareDeliveryExpansionTextures(scene: Phaser.Scene): void {
  const invalid = validateDeliveryExpansionTextures(scene);
  if (invalid.length) throw new Error(`Delivery expansion textures invalid: ${invalid.join(', ')}`);
  // Phaser FilterMode.NEAREST =1. Does not alter any existing art texture.
  DELIVERY_EXPANSION_ASSETS.forEach(asset => scene.textures.get(asset.key).setFilter(1));
}
